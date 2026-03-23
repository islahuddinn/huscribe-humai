import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class PortManager {
  constructor() {
    this.defaultPorts = [5001, 5002, 5003, 5004, 5005];
  }

  /**
   * Check if a specific port is in use
   */
  async isPortInUse(port) {
    try {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      return stdout.trim().length > 0;
    } catch (error) {
      return false; // Port is free
    }
  }

  /**
   * Get all Node.js processes
   */
  async getNodeProcesses() {
    try {
      // Use tasklist which works in both cmd and PowerShell
      const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV');
      if (!stdout.includes('node.exe')) return [];
      
      const lines = stdout.split('\n').slice(1); // Skip header
      const processes = lines
        .filter(line => line.includes('node.exe'))
        .map(line => {
          const parts = line.split(',');
          return {
            Id: parts[1] ? parts[1].replace(/"/g, '') : '',
            ProcessName: 'node.exe',
            StartTime: 'Available via tasklist'
          };
        })
        .filter(proc => proc.Id);
      
      return processes;
    } catch (error) {
      console.warn('Could not get Node processes:', error.message);
      return [];
    }
  }

  /**
   * Kill all Node.js processes
   */
  async killAllNodeProcesses() {
    try {
      console.log('🔄 Checking for Node.js processes...');
      const processes = await this.getNodeProcesses();
      
      if (processes.length === 0) {
        console.log('✅ No Node.js processes found');
        return;
      }

      console.log(`🎯 Found ${processes.length} Node.js process(es):`);
      processes.forEach(proc => {
        console.log(`   - PID: ${proc.Id}, Started: ${proc.StartTime}`);
      });

      console.log('🗑️  Terminating all Node.js processes...');
      await execAsync('taskkill /f /im node.exe 2>nul');
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('✅ All Node.js processes terminated');
    } catch (error) {
      console.log('ℹ️  No Node.js processes to terminate (or already terminated)');
    }
  }

  /**
   * Find the first available port
   */
  async findAvailablePort(startPort = 5001) {
    console.log(`🔍 Checking port availability starting from ${startPort}...`);
    
    const portsToCheck = startPort === 5001 
      ? this.defaultPorts 
      : [startPort, ...this.defaultPorts.filter(p => p !== startPort)];

    for (const port of portsToCheck) {
      const inUse = await this.isPortInUse(port);
      console.log(`   Port ${port}: ${inUse ? '❌ BUSY' : '✅ FREE'}`);
      
      if (!inUse) {
        console.log(`🎉 Selected port: ${port}`);
        return port;
      }
    }

    throw new Error(`All ports are busy: ${portsToCheck.join(', ')}`);
  }

  /**
   * Comprehensive port status report
   */
  async getPortReport() {
    console.log('\n📊 === PORT STATUS REPORT ===');
    
    // Check Node processes
    const nodeProcesses = await this.getNodeProcesses();
    console.log(`\n🔍 Node.js Processes: ${nodeProcesses.length}`);
    if (nodeProcesses.length > 0) {
      nodeProcesses.forEach(proc => {
        console.log(`   - PID: ${proc.Id}, Started: ${proc.StartTime}`);
      });
    }

    // Check port status
    console.log('\n🚪 Port Status:');
    for (const port of this.defaultPorts) {
      const inUse = await this.isPortInUse(port);
      console.log(`   Port ${port}: ${inUse ? '❌ BUSY' : '✅ FREE'}`);
    }

    // Check what's using ports
    try {
      const { stdout } = await execAsync('netstat -ano | findstr "5001 5002 5003 5004 5005"');
      if (stdout.trim()) {
        console.log('\n🔍 Processes using ports:');
        console.log(stdout);
      }
    } catch (error) {
      console.log('\n✅ No processes found using target ports');
    }

    console.log('=================================\n');
  }

  /**
   * Clean restart - kill processes and find free port
   */
  async cleanStart() {
    await this.getPortReport();
    await this.killAllNodeProcesses();
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const availablePort = await this.findAvailablePort();
    return availablePort;
  }
}

// CLI Usage
if (process.argv[2]) {
  const manager = new PortManager();
  
  switch (process.argv[2]) {
    case 'check':
      manager.getPortReport();
      break;
    case 'clean':
      manager.killAllNodeProcesses();
      break;
    case 'find':
      manager.findAvailablePort().then(port => {
        console.log(`Available port: ${port}`);
      });
      break;
    case 'report':
      manager.getPortReport();
      break;
    default:
      console.log('Usage: node portManager.js [check|clean|find|report]');
  }
}

export default PortManager; 