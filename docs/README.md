# COCOSSim Documentation

Welcome to the COCOSSim documentation! COCOSSim is a cycle-accurate neural network accelerator simulator designed for performance analysis of systolic array architectures.

## 📚 Documentation Structure

### Quick Start
- [Installation Guide](guides/installation.md) - Get up and running quickly
- [Basic Usage](guides/basic-usage.md) - Your first simulation

### Architecture & Design
- [Architecture Overview](guides/architecture.md) - High-level system design
- [Systolic Arrays](guides/systolic-arrays.md) - WS vs OS execution modes

### API Reference
- [Core Classes](api/core-classes.md) - Job, State, Arch classes

### Examples
- [Basic Examples](examples/basic.md) - Simple matmul and conv layers

### Development
- Building from Source - Compilation instructions
- Contributing - How to contribute
- Testing - Running tests and validation

## 🚀 Quick Links

- **[Get Started Now →](guides/installation.md)**
- **[View Examples →](examples/basic.md)**
- **[API Reference →](api/core-classes.md)**

## 🎯 Key Features

- **Cycle-Accurate Simulation**: Detailed timing models for systolic arrays
- **Multiple Execution Modes**: Weight Stationary (WS) and Output Stationary (OS)
- **Parallel Execution**: True multi-core simulation with independent scheduling
- **Memory Integration**: Realistic memory modeling with DRAMSim3
- **Flexible Layers**: Support for Matmul, Conv, Attention, and more
- **Performance Analysis**: Built-in metrics and visualization support

---

*For questions or support, please open an issue on GitHub.*