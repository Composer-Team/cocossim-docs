# Core Classes API Reference

This document describes the core classes that form the backbone of COCOSSim.

## Job Class

### Overview
The `Job` class represents a single computation task that can be executed by processing units.

### Declaration
```cpp
struct Job {
  virtual int get_type() const = 0;
  bool batched_weights = false;
  uint64_t addr;
  const uint64_t addr_hold;
  int task_idx;
  int job_idx;
  int core_id = -1;  // Core ID for parallel scheduling (-1 = any core)
  
  std::vector<Job *> children;
  int rem_deps;
  bool is_done = false;
  
  Job(uint64_t alloc_size);
  virtual std::string get_job_dims_string() const = 0;
  void printDetails() const;
};
```

### Key Methods

#### `get_type() -> int`
Returns the processing unit type required for this job.
- **Systolic Array Jobs**: Returns systolic array type ID
- **Vector Unit Jobs**: Returns vector unit type ID

#### `get_job_dims_string() -> string`
Returns a human-readable string describing the job dimensions.
**Example**: `"M=128,K=256,N=512"` for matrix multiplication

#### `printDetails()`
Prints comprehensive job information for debugging:
```cpp
job->printDetails();
// Output: Job Type: 0, Dims: M=128,K=256,N=512, Address: 0x1000, Task Index: 5, Remaining Dependencies: 2, Children Count: 3
```

### Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `task_idx` | `int` | Sequential task ID per core for dependency tracking |
| `job_idx` | `int` | Global unique job identifier |
| `core_id` | `int` | Target core for parallel execution (-1 = any core) |
| `addr` | `uint64_t` | Current memory address for data access |
| `addr_hold` | `uint64_t` | Original memory address (preserved during execution) |
| `children` | `vector<Job*>` | Jobs that depend on this job's completion |
| `rem_deps` | `int` | Number of remaining dependencies before execution |

### Derived Classes

#### SysArrayJob
Matrix multiplication jobs for systolic arrays:
```cpp
class SysArrayJob : public Job {
  int M, K, N;  // Matrix dimensions
  SysArrayJob(int m, int k, int n);
  string get_job_dims_string() const override;
};
```

#### VecUnitJob  
Element-wise operations for vector units:
```cpp
class VecUnitJob : public Job {
  int linearized_dimension;
  int parallel_dimension;  
  queue<pair<VPUPhase, int>> phases;
  VecUnitJob(int lin_dim, int par_dim, bool batched, vector<pair<VPUPhase, int>> ph);
};
```

---

## State Class

### Overview
Base class for processing unit state machines, managing memory operations and execution stages.

### Declaration
```cpp
class State {
protected:
  int state = 0;
  int min_stage_cycles = 0;
  int mem_read_left = 0, mem_write_left = 0;
  int mem_read_left_unqueued = 0, mem_write_left_unqueued = 0;
  int mem_queued = 0;
  bool is_idle_from_memory = false;
  
public:
  Job *j = nullptr;
  int vcd_idx;
  int core_memory_priority;
  
  virtual bool increment(const function<void(Job *)> &enqueue_job, int &total_idle, int *n_idle_units) = 0;
  virtual void init() = 0;
  virtual int get_ty_idx() const = 0;
  virtual string get_ty_string() const = 0;
  
protected:
  void enqueue_reads();
  void enqueue_writes();  
  bool process_stage();
  void check_idle_from_memory();
};
```

### Key Methods

#### `increment() -> bool`
**Purpose**: Execute one simulation cycle
**Returns**: `true` if unit is active (consuming power)
**Parameters**:
- `enqueue_job`: Function to enqueue dependent jobs upon completion
- `total_idle`: Reference to global idle unit counter
- `n_idle_units`: Array of idle units per type

**Implementation Pattern**:
```cpp
bool MyState::increment(const function<void(Job *)> &enqueue_job, int &total_idle, int *n_idle_units) {
    enqueue_reads();   // Queue memory reads
    enqueue_writes();  // Queue memory writes
    
    if (process_stage()) {
        // State machine logic here
        switch (state) {
            case STATE_A: /* transition logic */ break;
            case STATE_B: /* transition logic */ break;
        }
    }
    
    return is_active;  // Return true if consuming power
}
```

#### `init()`
Initialize the processing unit with a new job:
```cpp
void init() override {
    // Reset state machine
    state = initial_state;
    min_stage_cycles = 0;
    
    // Setup memory operations
    mem_read_left = calculate_reads();
    mem_write_left = calculate_writes();
    
    // Initialize unit-specific parameters
    setup_execution_parameters();
}
```

### Protected Methods

#### `enqueue_reads()`
Queue memory read transactions with bandwidth limits:
```cpp
void State::enqueue_reads() {
    if (mem_read_left_unqueued > 0) {
        int to_enq = min(dram_enq_per_cycle, mem_read_left_unqueued);
        mem_read_left_unqueued -= to_enq;
        mem_queued += to_enq;
        for (int i = 0; i < to_enq; ++i) {
            to_enqueue.emplace_back(j->addr, false, core_memory_priority, this);
            j->addr += bytes_per_tx;
        }
    }
}
```

#### `enqueue_writes()`
Queue memory write transactions with bandwidth limits (similar to reads but with `is_write = true`).

#### `process_stage() -> bool`
Process current execution stage:
```cpp
bool State::process_stage() {
    if (min_stage_cycles > 0) min_stage_cycles--;
    
    if (min_stage_cycles == 0 && mem_read_left == 0 && mem_write_left == 0) {
        return true;  // Stage complete, ready for state transition
    }
    
    check_idle_from_memory();
    return false;  // Stage still in progress
}
```

### Memory Management

#### Transaction Queuing
- **Bandwidth Limited**: Respects `dram_enq_per_cycle` limit
- **Priority Based**: Uses `core_memory_priority` for scheduling
- **Address Tracking**: Automatically increments addresses

#### Completion Callbacks
Memory operations complete asynchronously via callbacks:
```cpp
// Read completion decrements mem_read_left
// Write completion decrements mem_write_left
// When both reach 0, stage can complete
```

---

## Arch Class

### Overview
Main architecture class that coordinates the entire simulation, managing processing units and the global simulation loop.

### Key Methods

#### `get_cycles() -> RuntimeStats_t*`
Execute the main simulation loop:
```cpp
RuntimeStats_t *get_cycles(TimeBasedEnqueue &time_enqueues) {
    // Setup phase-based execution
    // Initialize per-core job queues  
    // Main simulation loop:
    //   - Process job scheduling
    //   - Update processing units
    //   - Handle memory transactions
    //   - Collect statistics
    // Return performance metrics
}
```

### Core Scheduling Algorithm

#### Per-Core Job Queues
```cpp
// Each task thread has independent job queues per processing unit type
map<int, vector<Job *> *> task_frontiers;
for (int i = 0; i < alloc_task_idx; ++i) {
    task_frontiers[i] = new vector<Job *>[n_types];
}
```

#### Round-Robin Task Selection
```cpp
for (int i = 0; i < n_types && !enqueued_job; ++i) {
    auto &fr = frontier[i];
    if (fr->empty()) {
        task_ids[i] = (task_ids[i] + 1) % n_threads;  // Round-robin
        fr = &(task_frontiers[task_ids[i]][i]);
    }
    
    if (!fr->empty() && n_idle_units[i] > 0) {
        // Assign job to available processing unit
        Job *job = fr->front();
        State *state = have_idle_type(i);
        // ... assignment logic
    }
}
```

### Performance Statistics

#### Per-Phase Metrics
```cpp
struct RuntimeStats_t {
    uint64_t cycles;
    double *pct_active;  // Per-unit utilization percentages
};
```

#### Collection Process
- **Per-Cycle**: Track active units
- **Per-Phase**: Calculate utilization statistics  
- **Memory**: Monitor DRAM command counts
- **Utilization**: Percentage active time per processing unit

---

## Usage Examples

### Creating and Executing Jobs
```cpp
// Create a matrix multiplication job
auto job = new SystolicArray::SysArrayJob(128, 256, 512);  // M, K, N
job->core_id = 0;  // Assign to core 0
job->task_idx = 5; // Task sequence number

// Create dependencies
Job *dependent_job = new SystolicArray::SysArrayJob(512, 256, 128);
job->children.push_back(dependent_job);
dependent_job->rem_deps = 1;

// Execute simulation
TimeBasedEnqueue enqueue;
enqueue.enqueue_at(0, {job});
auto stats = arch->get_cycles(enqueue);
```

### State Machine Implementation
```cpp
class MyProcessingUnit : public State {
    enum MyStates { IDLE, COMPUTE, WRITEBACK };
    
    bool increment(const function<void(Job *)> &enqueue_job, int &total_idle, int *n_idle_units) override {
        enqueue_reads();
        enqueue_writes();
        
        if (process_stage()) {
            switch (state) {
                case IDLE: break;  // Wait for job assignment
                case COMPUTE:
                    if (computation_done()) {
                        state_transfer(WRITEBACK, 0, output_size, 0);
                    }
                    break;
                case WRITEBACK:
                    // Job complete, enqueue dependent jobs
                    for (auto *child : j->children) {
                        if (--child->rem_deps == 0) {
                            enqueue_job(child);
                        }
                    }
                    state_transfer(IDLE, 0, 0, 0);
                    break;
            }
        }
        
        return state != IDLE;  // Active if not idle
    }
};
```

## See Also

- [Architecture Guide](../guides/architecture.md) - High-level system design
- [Basic Usage Guide](../guides/basic-usage.md) - Getting started with simulations