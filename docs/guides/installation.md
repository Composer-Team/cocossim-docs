# Installation Guide

This guide will help you install and set up COCOSSim on your system.

## Prerequisites

### System Requirements
- **OS**: Linux or macOS
- **Compiler**: GCC 8+ or Clang 10+ with C++17 support
- **Memory**: 4GB+ RAM recommended
- **Storage**: 2GB+ free space

### Dependencies
- **CMake** 3.16 or higher
- **Git** for cloning repositories
- **Python 3.6+** (optional, for visualization scripts)

## Installation Steps

### 1. Clone the Repository
```bash
git clone https://github.com/mc186/cocossim.git
cd cocossim
```

### 2. Initialize Submodules
COCOSSim uses DRAMSim3 as a submodule for memory simulation:
```bash
git submodule update --init --recursive
```

### 3. Build the Project
```bash
mkdir build && cd build
cmake ..
make -j$(nproc)
```

### 4. Verify Installation
Run a simple test to ensure everything works:
```bash
./cocossim ../examples/simple_matmul.txt
```

You should see output similar to:
```
PHASE: 0, Cycles: 1523, Jobs finished: 1/1, DRAM CMDs: 42
Cycles 1523
SYSTOLIC_ARRAY 85.234567
```

## Build Options

### Debug Build
For development and debugging:
```bash
cmake -DCMAKE_BUILD_TYPE=Debug ..
make -j$(nproc)
```

### VCD Waveform Generation
To enable VCD output for detailed analysis:
```bash
cmake -DVCD=ON ..
make -j$(nproc)
```

### Verbose Output
For detailed simulation logs:
```bash
cmake -DVERBOSE=ON ..
make -j$(nproc)
```

## Common Issues

### Issue: CMake version too old
**Error**: `CMake 3.16 or higher is required`
**Solution**: Update CMake:
```bash
# Ubuntu/Debian
sudo apt update && sudo apt install cmake

# macOS with Homebrew
brew install cmake
```

### Issue: Compiler not found
**Error**: `No suitable C++ compiler found`
**Solution**: Install build tools:
```bash
# Ubuntu/Debian
sudo apt install build-essential

# macOS
xcode-select --install
```

### Issue: DRAMSim3 submodule issues
**Error**: `dramsim3` directory empty
**Solution**: Reinitialize submodules:
```bash
git submodule update --init --recursive --force
```
<!-- 
## Docker Installation (Alternative)

If you prefer containerized installation:

```dockerfile
# Dockerfile
FROM ubuntu:20.04
RUN apt-get update && apt-get install -y \
    build-essential cmake git python3
COPY . /cocossim
WORKDIR /cocossim
RUN mkdir build && cd build && cmake .. && make -j4
```

```bash
docker build -t cocossim .
docker run -v $(pwd)/examples:/examples cocossim ./build/cocossim /examples/simple_matmul.txt
``` -->

## Next Steps

Once installed successfully:
[Basic Usage Guide](basic-usage.md) - Learn how to run your first simulation
<!-- 2. [Configuration Guide](configuration.md) - Understand simulation parameters
3. [Examples](../examples/basic.md) - Try different workloads -->

<!-- ## Getting Help

If you encounter issues:
- Check our [FAQ](faq.md)
- Review [common issues](#common-issues) above
- Open an issue on GitHub with your system details and error messages -->