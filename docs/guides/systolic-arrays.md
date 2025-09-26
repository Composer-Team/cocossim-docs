# Systolic Arrays Deep Dive

This guide provides detailed information about systolic array implementation and execution modes in COCOSSim.

## Overview

Systolic arrays are specialized hardware accelerators optimized for matrix multiplication operations, which form the computational core of neural network inference and training.

## Execution Modes

COCOSSim supports two primary execution modes that reflect real hardware implementations:

### Weight Stationary (WS) Mode

**Concept**: Weights remain stationary in the processing elements while activations flow through the array.

#### Advantages
- **Lower Weight Memory Traffic**: Weights loaded once per tile
- **Higher Compute Efficiency**: Good for compute-bound workloads
- **Better for Small Batch Sizes**: Efficient weight reuse

#### State Machine Flow
```
prefetch → read → shift → write → (next tile)
```

#### Detailed State Transitions

**1. Prefetch State**
```cpp
case prefetch:
  // Load weights into systolic array
  state_transfer(read, 0, 0, sj->M * max(systolic_fpu_latency, batch_size));
```
- **Purpose**: Pre-load weight matrix into systolic array PEs
- **Duration**: `M * max(systolic_fpu_latency, batch_size)` cycles
- **Memory**: No additional memory operations (weights pre-loaded)

**2. Read State**
```cpp
case read:  
  // Read input activations
  state_transfer(shift, 
                min(sz, sj->K) * min(sz, sj->N) * data_type_width,
                0,
                sz * max(systolic_fpu_latency, batch_size));
```
- **Purpose**: Read activation data from memory
- **Memory Read**: `min(sz, K) * min(sz, N) * data_type_width` bytes
- **Duration**: `sz * max(systolic_fpu_latency, batch_size)` cycles

**3. Shift State**
```cpp
case shift: {
  // Compute phase: shift data through systolic array
  int amt_to_write = 0, amt_to_read = 0;
  
  if (col_i == loop_cols_tiles) {
    if (row_i == loop_row_tiles) {
      amt_to_write = sj->M * sj->N * data_type_width * batch_size;
    } else {
      // Preload activations for next row
      amt_to_read = min(sz, sj->K) * sj->M * batch_size * data_type_width;
    }
  }
  state_transfer(write, amt_to_read, amt_to_write, 0);
}
```
- **Purpose**: Perform matrix multiplication computation
- **Computation**: Data flows through systolic array, accumulating partial products
- **Memory**: Conditional reads for next tile, writes when tile complete

**4. Write State**  
```cpp
case write: {
  int rd_cycles = sj->M * max(systolic_fpu_latency, batch_size);
  
  if (col_i == loop_cols_tiles) {
    if (row_i == loop_row_tiles) {
      // Job completed
      state_transfer(idle, 0, 0, 0);
      TO_IDLE_CLEANUP();
    } else {
      // Move to next row tile
      j->addr = j->addr_hold;
      state_transfer(read, 0, 0, rd_cycles);
      col_i = 1; row_i++;
    }
  } else {
    // Move to next column tile
    state_transfer(read, 0, 0, rd_cycles);
    col_i++;
  }
}
```
- **Purpose**: Write output data to memory and manage tiling
- **Memory Write**: Output partial sums or final results
- **Control Flow**: Advance to next tile or complete job

#### Tiling Strategy
WS mode uses **column-major tiling**:
```
Matrix C = A × B

For row_tiles in range(ceil(M/sz)):
  For col_tiles in range(ceil(N/sz)):
    Load weights B[col_tile] into systolic array
    For k_tiles in range(ceil(K/sz)):  
      Read activations A[row_tile, k_tile]
      Compute and accumulate C[row_tile, col_tile]
    Write C[row_tile, col_tile] to memory
```

### Output Stationary (OS) Mode

**Concept**: Output partial sums remain stationary while both weights and activations flow through.

#### Advantages  
- **Lower Output Memory Traffic**: Accumulate results in-place
- **Better for Large Batch Sizes**: Efficient output reuse
- **Streaming Friendly**: Continuous data flow

#### State Machine Flow
```
read → shift → write → (next tile)
```

#### Detailed State Transitions

**1. Read State**
```cpp
case read:
  // Read weights and activations
  state_transfer(shift, 0, 0, sz * min(systolic_fpu_latency, batch_size));
```
- **Purpose**: Read both weights and activations for current tile
- **Duration**: `sz * min(systolic_fpu_latency, batch_size)` cycles
- **Memory**: Load data for current computation tile

**2. Shift State**
```cpp
case shift:
  // Compute and accumulate outputs  
  state_transfer(write, 0, beats_per_wb, 0);
```
- **Purpose**: Perform computation while accumulating in output registers
- **Computation**: Matrix multiply with in-place accumulation
- **Memory Write**: `beats_per_wb` prepared for writeback

**3. Write State**
```cpp
case write:
  if (col_i == loop_cols_tiles) {
    if (row_i == loop_row_tiles) {
      // Job completed
      state_transfer(idle, 0, 0, 0);
      TO_IDLE_CLEANUP();
    } else {
      // Move to next row tile  
      init_row_loop(true);
      j->addr = j->addr_hold;
      UPDATE_STATE(read);
    }
  } else {
    // Continue with next column tile
    state_transfer(read, 0, 0, rd_cycles);
    col_i++;
  }
```
- **Purpose**: Write accumulated partial sums, manage tiling progression  
- **Memory**: Write partial or final accumulated results
- **Control**: Advance through tile iterations

#### Tiling Strategy
OS mode uses **row-major tiling** with accumulation:
```
Matrix C = A × B (C starts as zeros)

For row_tiles in range(ceil(M/sz)):
  For col_tiles in range(ceil(N/sz)):
    Load partial sums C[row_tile, col_tile]
    For k_tiles in range(ceil(K/sz)):
      Read weights B[k_tile, col_tile] 
      Read activations A[row_tile, k_tile]
      Compute and accumulate into C[row_tile, col_tile]
    Write updated C[row_tile, col_tile] to memory
```

## Performance Characteristics

### WS vs OS Trade-offs

| Aspect | Weight Stationary (WS) | Output Stationary (OS) |
|--------|------------------------|------------------------|
| **Weight Traffic** | Low (load once per tile) | High (load per k-tile) |
| **Activation Traffic** | High (load per tile) | High (load per tile) |
| **Output Traffic** | Medium (write per tile) | Low (accumulate in-place) |
| **Memory Bandwidth** | Activation-limited | Weight-limited |
| **Small Batch** | Better | Worse |
| **Large Batch** | Worse | Better |
| **Compute Utilization** | Higher | Lower (due to accumulation overhead) |

### When to Use Each Mode

**Use Weight Stationary (WS) when**:
- Small to medium batch sizes (1-32)
- Weight matrices fit comfortably in on-chip storage
- Activation data has good spatial locality
- Compute-bound workloads (high arithmetic intensity)

**Use Output Stationary (OS) when**:
- Large batch sizes (64+)  
- Output matrices are large and reused
- Memory bandwidth is the primary bottleneck
- Streaming data scenarios

## Buffer Management

### Buffer Size Calculations

#### WS Mode Buffer Requirements
```cpp
// Per core buffer requirement in WS mode
int required_buff_sz_per_core = (M * core_n + M * min(K, sa_sz_allo)) * batch_size * data_type_width;

bool core_is_bufferable = required_buff_sz_per_core <= buffer_size_bytes;
```

**Components**:
- **Output Buffer**: `M * core_n * batch_size * data_type_width`
- **Activation Buffer**: `M * min(K, sa_sz_allo) * batch_size * data_type_width`
- **Weight Buffer**: Assumed to fit in systolic array storage

#### Buffer Overflow Handling
When buffers are insufficient, COCOSSim automatically tiles:

```cpp
if (!core_is_bufferable) {
  // Calculate maximum bufferable output dimension
  float new_N_f = (float) buffer_size_bytes / (data_type_width * M * batch_size) - sa_sz_allo;
  int N_per_job = max(1, (int) floor(new_N_f));
  int num_sequential_jobs = (core_n + N_per_job - 1) / N_per_job;
  
  // Create multiple sequential jobs for this core
  for (int i = 0; i < num_sequential_jobs; ++i) {
    int current_N = min(N_per_job, remaining_N);
    auto job = new SysArrayJob(M, K, current_N);
    job->core_id = core;
    job->task_idx = core_task_counters[core]++;
  }
}
```

## Multi-Core Parallelism

### Tensor Parallelism Strategy

COCOSSim implements **N-dimension splitting** for tensor parallelism:

```cpp
// Split output dimension across cores
int core_n = N / n_cores;

// Each core processes independent slice of output
Core 0: processes output[:, 0:core_n]
Core 1: processes output[:, core_n:2*core_n] 
...
Core n: processes output[:, n*core_n:(n+1)*core_n]
```

### Core-Specific Scheduling

#### Job Assignment
```cpp
// Jobs assigned to specific cores for true parallelism
for (int core = 0; core < n_cores; ++core) {
  auto job = new SysArrayJob(M, K, core_n);
  job->core_id = core;  // Explicit core assignment
  job->task_idx = core_task_counters[core]++;  // Per-core task sequence
}
```

#### Independent Execution
Each core maintains:
- **Independent Job Queue**: `core_queues[core_idx]`
- **Separate Task Counters**: `core_task_counters[core]` 
- **Private Memory Addresses**: Non-overlapping address spaces
- **Autonomous Scheduling**: No inter-core synchronization required

## Advanced Features

### Configurable Array Sizes

COCOSSim supports various systolic array configurations:

```cpp
// Common configurations
sa_sz_allo = 64;   // 64x64 array (4K PEs)
sa_sz_allo = 128;  // 128x128 array (16K PEs)  
sa_sz_allo = 256;  // 256x256 array (64K PEs)
```

**Scaling Behavior**:
- **Larger Arrays**: Higher peak throughput, may have lower utilization
- **Smaller Arrays**: Better utilization, more memory traffic due to tiling

### Dynamic Execution Mode Selection

Future versions could support dynamic mode selection:

```cpp
// Hypothetical dynamic selection logic
ExecutionMode select_mode(int M, int K, int N, int batch_size) {
  float weight_reuse = (float)(M * N) / K;
  float output_reuse = (float)(K * N) / M;
  
  if (batch_size <= 32 && weight_reuse > 4.0) {
    return WEIGHT_STATIONARY;
  } else if (batch_size >= 64 && output_reuse > 2.0) {
    return OUTPUT_STATIONARY; 
  } else {
    return WEIGHT_STATIONARY;  // Default
  }
}
```

## Debugging and Analysis

### VCD Waveform Analysis  

Generate detailed execution traces:
```bash
cmake -DVCD=ON .. && make
./cocossim workload.txt  # Generates out.vcd
```

**Key Signals to Monitor**:
- `SYSTOLIC_ARRAY_*_STATE`: State machine progression
- `SYSTOLIC_ARRAY_*_IDLE_FROM_MEMORY`: Memory stall detection  
- `SYSTOLIC_ARRAY_*_JOB_IDX`: Job assignment tracking

### Performance Debugging

#### Low Utilization Diagnosis
```bash
# Check for memory stalls
grep "IDLE_FROM_MEMORY" out.vcd | wc -l

# Analyze state distribution  
grep "STATE" out.vcd | awk '{print $3}' | sort | uniq -c
```

#### Memory Bottleneck Detection
```bash
# High DRAM commands per cycle indicates memory bound
./cocossim workload.txt | awk '
/Cycles/ { cycles = $2 }
/DRAM CMDs/ { dram = $5 }
END { print "Memory Intensity:", dram/cycles }'
```

## Best Practices

### Workload Design
1. **Match Mode to Workload**: Use WS for small batches, OS for large batches
2. **Consider Buffer Constraints**: Design layer sizes to fit in available buffers
3. **Optimize for Reuse**: Maximize weight/output reuse patterns

### Multi-Core Efficiency
1. **Ensure Sufficient Parallelism**: N dimension should be >> number of cores
2. **Balance Memory Bandwidth**: Avoid memory bottlenecks with too many cores
3. **Monitor Per-Core Utilization**: Check that all cores are active

### Performance Tuning
1. **Profile Different Array Sizes**: Find optimal size for your workloads
2. **Compare Execution Modes**: Test both WS and OS for each workload type
3. **Analyze Memory Patterns**: Optimize for memory locality and bandwidth

## See Also

- [Architecture Guide](architecture.md) - High-level system design overview
- [Basic Usage Guide](basic-usage.md) - Getting started with simulations
- [Core Classes API](../api/core-classes.md) - Programming interface details