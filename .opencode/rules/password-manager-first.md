# Rule: Password Manager First

Whenever creating or modifying a set of credentials (SSH key, API token,
password, secret, or any authentication material), you MUST update the
password manager (Bitwarden / VaultWarden) **before** continuing to anything
else.

- **Right:** Create credential → add to BW → use it in config → proceed
- **Wrong:** Create credential → use it in config → (forget to save to BW)
- **Right:** Rotate a key → update BW → update configs that reference it
- **Wrong:** Rotate in-place, fix configs, then days later realize BW is stale

This rule ensures Bitwarden remains the canonical secrets store at all times.
A credential that exists only in config files or on disk is a credential that
will be lost when the machine is rebuilt.
