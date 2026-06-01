---
name: Tool output brand masking
description: bash/rg/grep output sometimes masks proper nouns; the read tool shows real content.
---

In this environment, `bash`/ripgrep output can replace certain proper nouns/brand
terms with short placeholders (observed: "whatsapp"→"n", "lotus"→"ln",
"fratelanza"→"ln", "openai"→"ln", and even a filename like `.replit` mangled).

**How to apply:** Do NOT trust exact brand/identifier strings copied from bash/rg
output. To read a precise name (package names, tokens, identifiers, file contents),
use the `read` tool, which returns unmasked content.
