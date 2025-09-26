# Basic Usage Guide

This guide covers the fundamentals of using COCOSSim to simulate neural network accelerator performance.

## Quick Start

### 1. Basic Simulation Command
```bash
./cocossim -c 1 -sa_sz 64 -sz_vu 64 -f 1 -i layers.txt -o results.txt
```

The simulator reads a layer configuration file specified with `-i` and outputs performance statistics to the file specified with `-o`.

### Command Line Options

#### Global Options
- `-i <file>`: Input layer configuration file (required)
- `-o <file>`: Output statistics file (required)  
- `-f <float>`: Operating frequency in GHz
- `-h`: Display help information

#### Architecture-Specific Options
- `-c <int>`: Number of compute cores
- `-sa_sz <int>`: Systolic array size (e.g., 64 for 64×64 array)
- `-sz_vu <int>`: Vector unit size
- `-ws <0|1>`: Dataflow mode (0=Output Stationary, 1=Weight Stationary)

### Layer Configuration Format

Create a txt file with operation specifications.
Create a simple matrix multiplication test:

**`simple_matmul.txt`**:
```
Matmul 128 256 512
```

This defines a matrix multiplication with dimensions M=128, K=256, N=512.

### 3. Run Your First Simulation
```bash
cd build
./cocossim -i ../examples/simple_matmul.txt -o results.txt
```

**Expected Output**:
```
processing Matmul 128 256 512
PHASE: 0, Cycles: 1523, Jobs finished: 1/1, DRAM CMDs: 42
Cycles 1523
SYSTOLIC_ARRAY 85.234567
VECTOR_UNIT 0.000000
```

## Understanding the Output

### Performance Metrics
- **Cycles**: Total simulation cycles to complete all jobs
- **Jobs finished**: Number of completed jobs out of total jobs
- **DRAM CMDs**: Total memory commands issued to DRAM
- **SYSTOLIC_ARRAY**: Utilization percentage of systolic arrays
- **VECTOR_UNIT**: Utilization percentage of vector units

## Layer Configuration Format

### Basic Syntax
```
LayerType dimension1 dimension2 ... dimensionN
```

### Supported Layer Types

#### Matmul (Matrix Multiplication)
```
# 2D Matrix: M x K × K x N = M x N
Matmul M K N

# 3D Batched: Batch x M x K × K x N = Batch x M x N  
Matmul Batch M K N
```

**Examples**:
```
Matmul 128 256 512          # 128×256 × 256×512 = 128×512
Matmul 8 128 256 512        # Batch=8, 128×256 × 256×512 per batch
```

#### Conv (Convolution)
```
# Basic Conv: batch, input_channels, input_height, input_width, output_channels
Conv batch in_ch in_h in_w out_ch

# Full Conv: includes kernel_size, stride, padding
Conv batch in_ch in_h in_w out_ch kernel_size stride padding
```

**Examples**:
```
Conv 1 3 224 224 64                    # Input: 1×3×224×224, Output: 1×64×222×222 (kernel=3, stride=1, pad=1 default)
Conv 1 3 224 224 64 3 1 1             # Explicit: kernel=3, stride=1, padding=1
Conv 1 64 112 112 128 3 2 1           # Stride=2 for downsampling
```

#### Activation Functions
```
# Element-wise activation on tensor
Activation total_elements

# Multi-dimensional activation  
Activation dim1 dim2 dim3 ...
```

**Examples**:
```
Activation 65536           # ReLU on 65536 elements
Activation 8 128 512       # Activation on 8×128×512 tensor
```

#### LayerNorm
```
# 1D LayerNorm
LayerNorm normalized_dim

# 2D LayerNorm  
LayerNorm batch_size normalized_dim

# Grouped LayerNorm
LayerNorm batch_size seq_len hidden_dim
```

### Advanced Layer Types

#### SelfAttention
```
# Basic Attention: seq_len, hidden_dim, hidden_dim
SelfAttention M K N

# Multi-Head Attention: num_heads, seq_len, hidden_dim, hidden_dim  
SelfAttention num_heads M K N
```

#### MatmulAct (Fused Matrix Multiplication + Activation)
```
MatmulAct M K N             # Matmul followed by activation
```

#### ActMatmul (Activation + Matrix Multiplication)  
```
ActMatmul M K N             # Activation followed by matmul
```

## Configuration Options

### Architecture Configuration
COCOSSim uses command-line arguments for configuration:

#### Command-Line Parameters
- `-c <cores>`: Number of cores (default: 1)
- `-sa_sz <size>`: Systolic array size (default: 64)
- `-sz_vu <size>`: Vector unit size (default: 64)
- `-ws <mode>`: Weight stationary mode (1=WS, 0=OS, default: 1)
- `-f <flag>`: Additional flags (1=verbose, default: 0)
- `-i <file>`: Input layer configuration file
- `-o <file>`: Output results file

#### Basic Configuration Examples
```bash
# Single core, 64x64 systolic array, WS mode
./cocossim -c 1 -sa_sz 64 -sz_vu 64 -ws 1 -i layers.txt -o results.txt

# Multi-core with larger systolic arrays
./cocossim -c 4 -sa_sz 128 -sz_vu 128 -ws 1 -i layers.txt -o results.txt

# Output stationary mode 
./cocossim -c 1 -sa_sz 64 -sz_vu 64 -ws 0 -f 1 -i layers.txt -o results.txt
```

### Memory Configuration  
Memory type is configured in the `src/memory.cc` file:
```bash
# Default config: dramsim3/configs/HBM2_8Gb_x128.ini
# Choose a different memory config or change parameters in this config.
```

## Multi-Layer Networks

### Sequential Layers
Define multiple layers in sequence:

**`cnn_example.txt`**:
```
Conv 1 3 224 224 64 7 2 3
Activation 1 64 112 112  
Conv 1 64 112 112 128 3 1 1
Activation 1 128 112 112
Conv 1 128 112 112 256 3 2 1
Activation 1 256 56 56
```

### Transformer Example
**`transformer_layer.txt`**:
```
SelfAttention 8 512 768 768
LayerNorm 8 512 768
Matmul 8 512 768 3072
Activation 8 512 3072  
Matmul 8 512 3072 768
LayerNorm 8 512 768
```

## Performance Analysis

### Comparing Configurations
Run the same workload with different settings:

```bash
# Single core baseline
./cocossim -c 1 -sa_sz 64 -ws 1 -i workload.txt -o single_core.log

# Multi-core comparison
./cocossim -c 4 -sa_sz 64 -ws 1 -i workload.txt -o multi_core.log

# Compare results
echo "Single Core:" && grep "Cycles" single_core.log
echo "Multi Core:" && grep "Cycles" multi_core.log
```

### Utilization Analysis
Monitor processing unit utilization in results.txt.
Low utilization may indicate:
- Memory bottlenecks
- Poor job parallelization  
- Insufficient workload size

### Memory Analysis
Track memory system performance using DRAMSim3 output statistics.

## Debugging and Visualization

### VCD Waveform Generation
Generate detailed execution traces:
```bash
# Build with VCD support
cmake -DVCD=ON .. && make

# Run simulation (generates out.vcd)
./cocossim -i workload.txt -o results.txt

# View with GTKWave or similar
gtkwave out.vcd
```

### Job Graph Visualization
View job dependencies in `jobs.dot`.

## Common Usage Patterns

### Benchmarking Different Architectures
```bash
#!/bin/bash
# Benchmark script example

workloads=("matmul_small.txt" "conv_resnet.txt" "transformer.txt")
core_counts=(1 2 4 8)

for workload in "${workloads[@]}"; do
    echo "=== Testing $workload ==="
    for cores in "${core_counts[@]}"; do
        ./cocossim -c $cores -sa_sz 64 -ws 1 -i $workload -o temp_results.txt
        result=$(grep "Cycles" temp_results.txt | awk '{print $2}')
        echo "Cores: $cores, Cycles: $result"
    done
done
```

### Parameter Sweeping
```bash
# Test different systolic array sizes
for size in 32 64 128 256; do
    ./cocossim -c 1 -sa_sz $size -ws 1 -i large_matmul.txt -o temp_results.txt
    cycles=$(grep "Cycles" temp_results.txt | awk '{print $2}')
    echo "SA_SIZE: $size, Cycles: $cycles"
done
```

### Workload Characterization
```bash
# Characterize workload memory vs compute intensity
./cocossim -i workload.txt -o results.txt
awk '
/Cycles/ { cycles = $2 }
/DRAM CMDs/ { dram = $5 }
/SYSTOLIC_ARRAY/ { sa_util = $2 }
END {
    print "Memory Intensity:", dram/cycles
    print "Compute Utilization:", sa_util"%"
    print "Commands per Cycle:", dram/cycles
}' results.txt
```

## Next Steps

Now that you understand basic usage:

1. **[Examples](../examples/basic.md)** - Try more complex workloads
2. **[Architecture Guide](architecture.md)** - Understand the underlying system design
<!-- 
## Troubleshooting

### Common Issues

**Issue**: Simulation hangs or takes very long
**Solution**: Check for very large layer dimensions or memory bottlenecks

**Issue**: Low utilization on multi-core runs  
**Solution**: Ensure workload has sufficient parallelism, try larger batch sizes

**Issue**: "Buffer not large enough" errors
**Solution**: Increase buffer sizes or enable automatic tiling

**Issue**: Inconsistent results between runs
**Solution**: Ensure deterministic scheduling, avoid debug output that affects timing -->