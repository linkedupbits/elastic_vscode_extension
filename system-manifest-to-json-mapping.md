# System Integration: manifest.yml → JSON Package Policy Mapping

This document explains how the System package's `manifest.yml` file maps to the actual JSON package policy structure shown in your example.

---

## Overview

The System integration uses a **single policy template** with **multiple conditional inputs** that select different data collection methods based on the OS platform and version.

### Source Files
- **Package Manifest**: `packages/system/manifest.yml`
- **Data Streams**: `packages/system/data_stream/{auth,syslog,core,cpu,diskio,filesystem,...}`

---

## Manifest Structure → JSON Mapping

### 1. **Package Information**

#### manifest.yml
```yaml
format_version: 3.0.0
name: system
title: System
version: 2.3.2
requires_root: true
type: integration
```

#### → JSON Output
```json
{
  "package": {
    "name": "system",
    "title": "System",
    "version": "2.3.2",
    "requires_root": true
  }
}
```

---

### 2. **Policy Template → Inputs Mapping**

The System package defines a **single policy template** with **4 conditional inputs**. This is the key to understanding the mapping:

#### manifest.yml
```yaml
policy_templates:
  - name: linux
    title: System Logs and Metrics
    description: Collect logs and metrics from the System
    
    inputs:
      # INPUT 1: Logfile (traditional Linux log files)
      - type: logfile
        title: Collect logs from the system
        description: Collect logs from traditional log files
        vars:
          - name: condition
            type: text
            title: Condition
            value: '${host.os_version} != "12 (bookworm)" and (${host.os_platform} != "amzn" or ${host.os_version} != "2023")'
      
      # INPUT 2: Journald (systemd journal - for Debian 12, Amazon Linux 2023)
      - type: journald
        title: Collect logs from journald
        description: Collect logs from journald for modern Linux distributions
        vars:
          - name: condition
            type: text
            title: Condition
            value: '${host.os_version} == "12 (bookworm)" or (${host.os_platform} == "amzn" and ${host.os_version} == "2023")'
      
      # INPUT 3: Winlog (Windows Event Logs)
      - type: winlog
        title: Collect logs from Windows Event Log
        description: Collect logs from Windows Event Log
      
      # INPUT 4: System Metrics
      - type: system/metrics
        title: Collect system metrics
        description: Collect system metrics from the system
```

#### → JSON Output

The `inputs` in the JSON are **keyed by a combination of input type and display name**:

```json
{
  "inputs": {
    "system-logfile": {
      "enabled": true,
      "vars": {
        "condition": "${host.os_version} != \"12 (bookworm)\" and (${host.os_platform} != \"amzn\" or ${host.os_version} != \"2023\")"
      },
      "streams": { /* see below */ }
    },
    
    "system-journald": {
      "enabled": true,
      "vars": {
        "condition": "${host.os_version} == \"12 (bookworm)\" or (${host.os_platform} == \"amzn\" and ${host.os_version} == \"2023\")"
      },
      "streams": { /* see below */ }
    },
    
    "system-winlog": {
      "enabled": false,
      "streams": { /* see below */ }
    },
    
    "system-system/metrics": {
      "enabled": true,
      "vars": {},
      "streams": { /* see below */ }
    }
  }
}
```

**Key Points:**
- The input **key** combines the package name + input type (e.g., `system-logfile`)
- The **`condition` variable** is a CEL expression that determines when this input is active
  - Logfile: Only when NOT Debian 12 AND NOT (Amazon Linux 2023)
  - Journald: Only when Debian 12 OR Amazon Linux 2023
  - This allows **conditional execution** based on OS

---

### 3. **Data Streams → Streams Mapping**

Each **input** contains **streams**. Streams correspond to **data streams** defined in the package's `data_stream/` folders.

#### manifest.yml (Data Stream Level)
```
packages/system/data_stream/
├── auth/
│   └── manifest.yml (defines the "system.auth" stream)
├── syslog/
│   └── manifest.yml (defines the "system.syslog" stream)
├── core/
│   └── manifest.yml (defines the "system.core" stream)
├── cpu/
│   └── manifest.yml (defines the "system.cpu" stream)
└── [... other data streams ...]
```

Each data stream's `manifest.yml` defines its input type and variables.

#### Example: system/data_stream/auth/manifest.yml
```yaml
type: logs
title: Auth logs
streams:
  - input: logfile
    title: Auth logs
    description: Collect auth logs
    vars:
      - name: paths
        type: text
        multi: true
        default:
          - /var/log/auth.log*
          - /var/log/secure*
      - name: ignore_older
        type: text
        default: 72h
      - name: preserve_original_event
        type: bool
        default: false
      - name: tags
        type: text
        multi: true
```

#### → JSON Output

The stream name becomes the **key in the streams object**. Variables are populated from both the data stream definition AND user configuration:

```json
{
  "inputs": {
    "system-logfile": {
      "streams": {
        "system.auth": {
          "enabled": true,
          "vars": {
            "ignore_older": "72h",
            "paths": [
              "/var/log/auth.log*",
              "/var/log/secure*"
            ],
            "preserve_original_event": false,
            "tags": ["system-auth"]
          }
        },
        
        "system.syslog": {
          "enabled": true,
          "vars": {
            "paths": [
              "/var/log/messages*",
              "/var/log/syslog*",
              "/var/log/system*",
              "/var/log/maillog*"
            ],
            "preserve_original_event": false,
            "tags": [],
            "ignore_older": "72h",
            "exclude_files": ["\\.gz$"]
          }
        }
      }
    },
    
    "system-journald": {
      "streams": {
        "system.auth": {
          "enabled": true,
          "vars": {
            "preserve_original_event": false,
            "paths": [],
            "include_matches": [],
            "tags": []
          }
        },
        
        "system.syslog": {
          "enabled": true,
          "vars": {
            "preserve_original_event": false,
            "paths": [],
            "include_matches": [],
            "tags": []
          }
        }
      }
    }
  }
}
```

**Key Observations:**
- `system.auth` appears in BOTH `system-logfile` and `system-journald` inputs
  - But with **different variables** (logfile uses `paths`, journald uses `include_matches`)
- The **stream name** (`system.auth`, `system.syslog`) comes from the data stream's dataset
- **Variables merge** package defaults + user overrides

---

### 4. **Metrics Streams Example**

For the metrics input (`system-system/metrics`), the data stream structure is similar but maps to metric collection:

#### packages/system/data_stream/cpu/manifest.yml
```yaml
type: metrics
title: CPU metrics
streams:
  - input: system/metrics
    title: System CPU metrics
    description: Collect CPU metrics
    vars:
      - name: period
        type: text
        default: 10s
      - name: cpu.metrics
        type: text
        multi: true
        default:
          - percentages
          - normalized_percentages
      - name: tags
        type: text
        multi: true
```

#### → JSON Output
```json
{
  "inputs": {
    "system-system/metrics": {
      "enabled": true,
      "vars": {},
      "streams": {
        "system.cpu": {
          "enabled": true,
          "vars": {
            "period": "10s",
            "cpu.metrics": [
              "percentages",
              "normalized_percentages"
            ],
            "tags": [],
            "use_performance_counters": false
          }
        },
        
        "system.core": {
          "enabled": true,
          "vars": {
            "period": "10s",
            "core.metrics": ["percentages"],
            "tags": [],
            "use_performance_counters": false
          }
        },
        
        "system.diskio": {
          "enabled": true,
          "vars": {
            "period": "10s",
            "diskio.include_devices": [],
            "tags": []
          }
        }
        
        /* ... more metric streams ... */
      }
    }
  }
}
```

---

## Complete Flow: manifest.yml → JSON

### Step 1: Package Initialization
```yaml
# manifest.yml (root)
name: system
version: 2.3.2
```
↓
```json
{
  "package": {
    "name": "system",
    "version": "2.3.2"
  }
}
```

### Step 2: Policy Template Creation
```yaml
# manifest.yml
policy_templates:
  - name: linux
    inputs:
      - type: logfile
        vars:
          - name: condition
            value: '...'
      - type: journald
        vars:
          - name: condition
            value: '...'
      - type: system/metrics
```
↓
```json
{
  "inputs": {
    "system-logfile": {
      "enabled": true,
      "vars": { "condition": "..." }
    },
    "system-journald": {
      "enabled": true,
      "vars": { "condition": "..." }
    },
    "system-system/metrics": {
      "enabled": true
    }
  }
}
```

### Step 3: Streams Population
```yaml
# data_stream/auth/manifest.yml
type: logs
streams:
  - input: logfile
    vars:
      - name: paths
        default: ['/var/log/auth.log*']
```
↓
```json
{
  "inputs": {
    "system-logfile": {
      "streams": {
        "system.auth": {
          "enabled": true,
          "vars": {
            "paths": ["/var/log/auth.log*"]
          }
        }
      }
    }
  }
}
```

---

## Variable Resolution Hierarchy

Variables in the final JSON come from this hierarchy (top wins):

1. **User-provided values** (Fleet UI or API)
2. **Data stream defaults** (data_stream/*/manifest.yml)
3. **Package-level defaults** (packages/system/manifest.yml)
4. **Built-in field types**

Example for `system.auth.paths`:
```
User provided "C:\Windows\System32\winevt\Logs\Security.evtx" → Use this
           ↓ (not provided)
Data stream default ["/var/log/auth.log*", "/var/log/secure*"] → Use this
           ↓ (no default)
Field type (text, multi) → Allow any string array
```

---

## Key Architectural Patterns

### 1. **Conditional Inputs (OS-Based Switching)**
The System integration uses `condition` variables to **select inputs based on runtime conditions**:

```json
{
  "system-logfile": {
    "vars": {
      "condition": "${host.os_version} != \"12 (bookworm)\" ..."
    }
  },
  "system-journald": {
    "vars": {
      "condition": "${host.os_version} == \"12 (bookworm)\" ..."
    }
  }
}
```

This allows **single policy** → **multiple input types** depending on OS.

### 2. **Stream-Level Enabling**
Each stream can be independently enabled/disabled:

```json
{
  "streams": {
    "system.auth": { "enabled": true },
    "system.syslog": { "enabled": false }
  }
}
```

### 3. **Input-Level Enabling**
Each input can also be independently enabled (less common):

```json
{
  "system-logfile": { "enabled": true },
  "system-winlog": { "enabled": false }
}
```

---

## Relationship to Elasticsearch & Kibana

The final JSON policy is **interpreted by Elastic Agent** to:

1. **Select inputs** based on `condition` variables
2. **Enable/disable data collection** for each stream
3. **Apply variables** to configure collectors
4. **Output to Elasticsearch** with `data_stream.{type,dataset,namespace}` fields
5. **Power Kibana dashboards** using these data streams

Example resulting Elasticsearch documents:
```json
{
  "data_stream": {
    "type": "logs",
    "dataset": "system.auth",
    "namespace": "default"
  },
  "message": "user login successful",
  "@timestamp": "2024-08-03T..."
}
```

---

## Summary

| Level | manifest.yml | → | JSON |
|-------|---|---|---|
| **Package** | `name`, `version` | → | `package.name`, `package.version` |
| **Policy Template** | `policy_templates[].inputs[]` | → | `inputs["system-{type}"]` |
| **Input Variables** | `inputs[].vars[]` | → | `inputs["system-{type}"].vars` |
| **Data Stream** | `data_stream/*/manifest.yml` | → | Stream definitions per input |
| **Stream Name** | `data_stream.dataset` | → | `inputs["..."].streams["system.{name}"]` |
| **Stream Variables** | `streams[].vars[]` | → | `inputs["..."].streams["..."].vars` |

This hierarchical structure allows **flexible configuration** while maintaining **predictable structure** for Fleet management.
