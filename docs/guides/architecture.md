# Architecture Overview

COCOSSim is designed as a modular, cycle-accurate simulator for neural network accelerators with systolic array architectures.
COCOSSim uses **state machine models** at its core to simulate compute units with cycle-accurate precision. Each processing unit (systolic arrays and vector units) is implemented as a finite state machine that interacts with the job scheduler and memory system through well-defined interfaces.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    COCOSSim Architecture                     │
├─────────────────┬───────────────────┬───────────────────────┤
│   Layer Parser  │   Job Scheduler   │   Performance Stats   │
│                 │                   │                       │
│ • Matmul        │ • Task Queues     │ • Cycle Counts       │
│ • Convolution   │ • Dependencies    │ • Utilization        │
│ • Attention     │ • Multi-threading │ • Memory Traffic     │
│ • Activation    │                   │                       │
└─────────────────┼───────────────────┼───────────────────────┘
                  │                   │
┌─────────────────┼───────────────────┼───────────────────────┐
│           Processing Units          │      Memory System    │
├─────────────────┬───────────────────┼───────────────────────┤
│ Systolic Arrays │  Vector Units     │      DRAMSim3        │
│                 │                   │                       │
│ • WS Mode       │ • Element-wise    │ • HBM/DDR Models     │
│ • OS Mode       │ • Reductions      │ • Banking/Channels   │
│ • Tiling Logic  │ • Broadcasts      │ • Realistic Timing   │
│ • State Machine │ • Multi-phase     │ • Priority Queues    │
└─────────────────┴───────────────────┴───────────────────────┘
```

## Core Components

### 1. Frontend System
**Purpose**: Translate high-level neural network descriptions into executable jobs

**Components**:
- **Layer Parser**: Converts layer specifications into job graphs
- **Job Creation**: Handles tensor parallelism and buffer constraints
- **Dependency Management**: Manages inter-layer data dependencies

**Key Files**:
- `src/frontends/standard/StandardLayers.cc` - Layer implementations
- `src/frontends/standard/StandardParser.cc` - Configuration parsing

### 2. Job Scheduling System
**Purpose**: Coordinate execution across multiple processing units

**Key Features**:
- **Task-Based Parallelism**: Independent job queues per task thread
- **Core Assignment**: Jobs assigned to specific cores for true parallelism
- **Dependency Resolution**: Automatic handling of data dependencies
- **Multi-Period Execution**: Support for streaming workloads

**Key Files**:
- `src/Arch.cc` - Main simulation loop and job scheduling
- `src/Job.cc` - Job creation and dependency tracking

### 3. Processing Units

#### Systolic Arrays
**Purpose**: Matrix multiplication and convolution operations

**Execution Modes**:
- **Weight Stationary (WS)**: Weights stay in place, activations flow
- **Output Stationary (OS)**: Partial sums accumulate in place

**State Machine**:
```
WS Mode: prefetch → read → shift → write → (next tile)
OS Mode: read → shift → write → (next tile)
```

**Key Features**:
- Configurable array sizes (64x64, 128x128, etc.)
- Automatic tiling for large matrices
- Buffer constraint handling

#### Vector Units
**Purpose**: Element-wise operations, activations, normalization

**Phases**:
- **REDUCE**: Reductions along dimensions
- **BROADCAST**: Element-wise operations
- **Multi-phase**: Complex operations like LayerNorm

**Key Files**:
- `src/units/standard/SysArray.cc` - Systolic array implementation
- `src/units/standard/VectorUnit.cc` - Vector unit implementation

### 4. Memory Subsystem
**Purpose**: Realistic memory modeling with timing accuracy

**Integration**: Uses DRAMSim3 for cycle-accurate memory simulation

**Features**:
- **Priority-based Transactions**: Memory operations with different priorities
- **Callback System**: Completion notifications for processing units
- **Multiple Memory Types**: HBM, DDR4, DDR5 support
- **Banking/Channel Models**: Realistic memory hierarchy

**Key Files**:
- `src/memory.cc` - Memory transaction management
- `dramsim3/` - Memory simulator submodule

### 5. State Management
**Purpose**: Coordinate processing unit states and memory operations

**Responsibilities**:
- **Memory Queue Management**: Read/write transaction queuing
- **Stage Processing**: Cycle-based state transitions
- **Idle Detection**: Power and utilization tracking
- **VCD Generation**: Waveform output for debugging

**Key Files**:
- `src/State.cc` - Base state machine implementation
- `include/State.h` - State interface and VCD macros

## Data Flow

### 1. Initialization Phase
```
Layer File → Parser → Job Graph → Task Assignment → Core Allocation
```

### 2. Execution Phase  
```
Job Queue → Scheduler → Processing Unit → Memory System → Completion
     ↑                                                        │
     └────────────────── Dependencies ──────────────────────┘
```

### 3. Multi-Core Execution
```
Core 0: [Job Queue] → [Systolic Array] → [Memory]
Core 1: [Job Queue] → [Systolic Array] → [Memory]  
Core 2: [Job Queue] → [Vector Unit]   → [Memory]
Core 3: [Job Queue] → [Vector Unit]   → [Memory]
```

## Key Design Decisions

### Parallel Execution Strategy
- **Core-Specific Job Queues**: Each core maintains independent job queues
- **Per-Core Task Counters**: Sequential task IDs per core for dependency tracking
- **No Global Synchronization**: Cores operate independently unless data dependent

### Memory Model Integration
- **Transaction-Based Interface**: All memory operations go through DRAMSim3
- **Priority System**: Different operation types have configurable priorities
- **Asynchronous Callbacks**: Processing units notified when memory operations complete

### Modular Design
- **Frontend Abstraction**: Easy to add new layer types and architectures
- **Unit Pluggability**: Processing units implement common interfaces
- **Configuration Driven**: Architecture parameters specified in config files

## Performance Considerations

### Simulation Speed
- **Event-Driven**: Only processes active components each cycle
- **Efficient Memory Management**: Minimizes allocation/deallocation overhead
- **Parallel Build Support**: Multi-threaded compilation

### Memory Usage
- **Job Pooling**: Reuses job objects when possible
- **Selective VCD**: VCD generation only when enabled
- **Configurable Buffers**: Memory usage scales with architecture size

### Accuracy vs Speed
- **Cycle-Accurate Core**: Precise timing for processing units
- **Configurable Memory Detail**: Balance between accuracy and simulation speed
- **Statistical Sampling**: Optional sampling for very long workloads

## Extension Points

### Adding New Layer Types
1. Implement layer logic in `StandardLayers.cc`
2. Add parser support in layer configuration
3. Define job creation and dependency rules

### Adding New Processing Units  
1. Inherit from `State` base class
2. Implement state machine in `increment()` method
3. Register unit type in architecture configuration

### Custom Memory Models
1. Modify memory transaction interface
2. Integrate alternative memory simulators
3. Adjust callback mechanisms as needed

## Next Steps

- [Systolic Arrays Deep Dive](systolic-arrays.md) - Detailed WS/OS mode explanation
- [Basic Usage Guide](basic-usage.md) - Getting started with simulations
- [Core Classes API](../api/core-classes.md) - Programming interface details