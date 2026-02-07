# Channel Documentation

This folder contains documentation for the OpenClaw WebHub Channel plugin.

## Structure

```
docs/
├── channel/          # Channel SDK implementation docs
│   ├── README.md     # This file
│   ├── 01-overview.md
│   ├── 02-sdk-messages.md
│   ├── 02-message-schema.md
│   ├── 03-usage-guide.md
│   ├── 04-capabilities.md
│   ├── 05-api-endpoints.md
│   ├── 06-configuration.md
│   ├── 07-message-flows.md
│   ├── 08-error-handling.md
│   ├── 09-security.md
│   ├── 10-implementation.md
│   ├── 11-testing.md
│   ├── 12-appendix.md
│   └── images/
│       ├── diagram-01.png ~ diagram-08.png
│       ├── diagram-sdk-inbound-flow.png
│       ├── diagram-sdk-outbound-flow.png
│       ├── diagram-type-layers.png
│       ├── diagram-type-inheritance.png
│       └── diagram-type-flow.png
└── webhub/           # Website/WebHub design docs (TBD)
```

## Overview

The WebHub Channel plugin enables OpenClaw to connect to any Website that implements the WebHub REST API specification.

- **Website Layer**: JSON formats that the Website must implement
- **WebHub SDK**: Adapter types for the channel plugin
- **Channel SDK**: OpenClaw SDK standard interfaces

## Quick Links

- [Overview](01-overview.md)
- [SDK Messages](02-sdk-messages.md)
- [Message Schema](02-message-schema.md)
- [Usage Guide](03-usage-guide.md)
- [Capabilities](04-capabilities.md)
- [API Endpoints](05-api-endpoints.md)
- [Configuration](06-configuration.md)
- [Message Flows](07-message-flows.md)
- [Error Handling](08-error-handling.md)
- [Security](09-security.md)
- [Implementation Plan](10-implementation.md)
- [Testing](11-testing.md)
- [Appendix](12-appendix.md)

---

*Last updated: 2026-02-06*
