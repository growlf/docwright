#!/bin/bash
# =============================================================================
# DocWright - Pre-Commit Hook (slim)
# =============================================================================
# Validates:
# 1. Identity resolution + network (cached in /tmp/)
# 2. Commit message format
# 3. Frontmatter integrity (all lifecycle directories)
# 4. assigned_to field (BLOCK empty for approved/in-progress plans)
# 5. Automated field (enum: off|guided|full)
# 6. Template variable check
# 7. Scenario synthesis for automation plans
# 8. Agent Instructions section validation
# =============================================================================

REPO_ROOT="$(git rev-parse --show-toplevel)" && cd "$REPO_ROOT" || exit 1

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
print_error()   { echo -e "${RED}[✗]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
print_status()  { echo -e "${GREEN}[✓]${NC} $1"; }

# =============================================================================
# 1. Identity + Network (cached in /tmp/)
# =============================================================================
resolve_identity() {
    local CACHE_FILE="/tmp/opencode-identity-cache"
    if [ -f "$CACHE_FILE" ] && [ "$(( $(date +%s) - $(stat -c %Y "$CACHE_FILE") ))" -lt 3600 ]; then
        cat "$CACHE_FILE"; return
    fi
    local ENV_FILE="$REPO_ROOT/.env" HOST=$(hostname) NAME="" EMAIL="" HAS_ISSUES=0
    [ -f "$ENV_FILE" ] && NAME=$(grep "^OPCODE_USER_NAME=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' | xargs)
    [ -f "$ENV_FILE" ] && EMAIL=$(grep "^OPCODE_USER_EMAIL=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' | xargs)
    local GIT_NAME=$(git config user.name 2>/dev/null || echo "")
    local GIT_EMAIL=$(git config user.email 2>/dev/null || echo "")
    [ -z "$NAME" ] || [ "$NAME" = "Your Full Name" ] && NAME="$GIT_NAME" && HAS_ISSUES=1
    [ -z "$EMAIL" ] && EMAIL="$GIT_EMAIL" && HAS_ISSUES=1
    [ -n "$GIT_NAME" ] && [ -n "$NAME" ] && [ "$GIT_NAME" != "$NAME" ] && echo "WARN .env user ($NAME) != git config ($GIT_NAME)" && HAS_ISSUES=1
    [ -n "$GIT_EMAIL" ] && [ -n "$EMAIL" ] && [ "$GIT_EMAIL" != "$EMAIL" ] && echo "WARN .env email ($EMAIL) != git config ($GIT_EMAIL)" && HAS_ISSUES=1
    local MSG="Human: $NAME ($EMAIL) | Machine: $HOST"
    [ $HAS_ISSUES -ne 0 ] && MSG="$MSG (has issues)"
    echo "$MSG" | tee "$CACHE_FILE"
}

detect_network() {
    local CACHE_FILE="/tmp/opencode-network-cache"
    if [ -f "$CACHE_FILE" ] && [ "$(( $(date +%s) - $(stat -c %Y "$CACHE_FILE") ))" -lt 3600 ]; then
        cat "$CACHE_FILE"; return
    fi
    local GATEWAY=$(ip route show default | awk '{print $3}' 2>/dev/null)
    local IFACE=$(ip route show default | awk '{print $5}' 2>/dev/null)
    local TRACE=$(traceroute -n -m 2 -q 1 -w 2 8.8.8.8 2>/dev/null | tail -n +2 | head -2 | awk '{print $2}' | tr '\n' ' > ')
    local HINT="Unknown"
    echo "$TRACE" | grep -q "^10\." && HINT="Private LAN (10.x)"
    echo "$TRACE" | grep -q "^192\.168\." && HINT="Home LAN"
    echo "$TRACE" | grep -q "^172\.1[6-9]\." && HINT="Private LAN (172.x)"
    [ -z "$TRACE" ] && HINT="No internet route"
    echo "Network: $HINT ($IFACE, gw: $GATEWAY)" | tee "$CACHE_FILE"
}

print_warning "$(resolve_identity)"
print_status "$(detect_network)"

# =============================================================================
# 2. Commit message format
# =============================================================================
validate_commit_message() {
    [ ! -f ".git/COMMIT_EDITMSG" ] && return 0
    local msg=$(head -1 .git/COMMIT_EDITMSG | tr -d '\r')
    [ -z "$msg" ] && return 0
    echo "$msg" | grep -qE '^(feat|fix|docs|refactor|test|chore): .+' && return 0
    print_error "Commit message must follow: <type>: <description>"
    print_error "Types: feat, fix, docs, refactor, test, chore"
    exit 1
}
validate_commit_message

# =============================================================================
# 3. Gather staged markdown files
# =============================================================================
STAGED=$(git diff --cached --name-only)
[ -z "$STAGED" ] && print_warning "No staged files to validate" && exit 0

# =============================================================================
# 4-8. Validation helpers
# =============================================================================
get_frontmatter() { awk 'BEGIN{c=0} /^---$/{c++; next} c==1{print} c==2{exit}' "$1"; }

validate_assigned_to() {
    local FILE=$1 TYPE=$2 FM=$(get_frontmatter "$FILE")
    [ -z "$FM" ] && return 0
    local ASSIGNED=$(echo "$FM" | python3 -c "import sys,yaml; fm=yaml.safe_load(sys.stdin); a=fm.get('assigned_to',[]); print(a[0]) if a and len(a)>0 else None" 2>/dev/null)
    [ "$TYPE" = "proposal" ] && echo "$FM" | grep -q "^approved: true" && { [ -z "$ASSIGNED" ] && print_warning "$FILE: Approved but assigned_to empty!" && return 0; }
    if [ "$TYPE" = "plan" ]; then
        local STATUS=$(echo "$FM" | grep "^status:" | sed 's/^status: *//')
        if echo "$STATUS" | grep -qE '^(approved|in-progress)$' && { [ -z "$ASSIGNED" ] || [ "$ASSIGNED" = "None" ]; }; then
            print_error "$FILE: status=$STATUS but assigned_to empty!"; return 1
        fi
    fi
    return 0
}

validate_automated() {
    local FILE=$1; [[ ! "$FILE" =~ ^plans/[^/]+\.md$ ]] || [[ "$FILE" =~ ^plans/completed/ ]] && return 0
    local FM=$(get_frontmatter "$FILE"); [ -z "$FM" ] && return 0
    local AUTO=$(echo "$FM" | grep "^automated:" | sed 's/^automated: *//' | tr -d ' ')
    [ -n "$AUTO" ] && [ "$AUTO" != "off" ] && [ "$AUTO" != "guided" ] && [ "$AUTO" != "full" ] && print_error "$FILE: automated must be off|guided|full (got: $AUTO)" && return 1
    return 0
}

validate_template_vars() {
    local FILE=$1; [[ ! "$FILE" =~ ^docs/ ]] && [[ ! "$FILE" =~ ^plans/[^/]+\.md$ ]] && return 0
    grep -qE '\{\{VALUE:|DATE:YYYY' "$FILE" 2>/dev/null && print_error "$FILE: Unresolved template variables!" && return 1
    return 0
}

validate_scenario_synthesis() {
    local FILE=$1; [[ ! "$FILE" =~ ^plans/[^/]+\.md$ ]] || [[ "$FILE" =~ ^plans/completed/ ]] && return 0
    local CONTENT=$(cat "$FILE" 2>/dev/null)
    echo "$CONTENT" | grep -qiE '(bash|shell|script|sed |awk |python|deploy|generator|pipeline|batch.*edit)' || return 0
    local FM=$(get_frontmatter "$FILE"); local STATUS=$(echo "$FM" | grep "^status:" | sed 's/^status: *//')
    echo "$STATUS" | grep -qE '^(approved|in-progress)$' || return 0
    echo "$FM" | grep -q "^scenario_synthesis:" && return 0
    print_error "$FILE: Involves automation but missing scenario_synthesis!"; return 1
}

validate_agent_instructions() {
    local FILE=$1; [[ ! "$FILE" =~ ^docs/SOPs/ ]] && return 0
    grep -q '<agent-instructions' "$FILE" 2>/dev/null || { print_warning "$FILE: SOP missing Agent Instructions section"; return 0; }
    grep -q '</agent-instructions>' "$FILE" 2>/dev/null || { print_error "$FILE: Agent Instructions tag unclosed!"; return 1; }
    grep -q 'triggers=' "$FILE" 2>/dev/null || { print_warning "$FILE: Agent Instructions missing triggers attribute"; return 0; }
    return 0
}

# =============================================================================
# Main validation loop
# =============================================================================
ERRORS=0; WARNINGS=0
for FILE in $STAGED; do
    [[ ! "$FILE" =~ \.md$ ]] && continue
    validate_template_vars "$FILE" || ((ERRORS++))
    [[ "$FILE" =~ ^plans/[^/]+\.md$ ]] && [[ ! "$FILE" =~ ^plans/completed/ ]] && { validate_automated "$FILE" || ((ERRORS++)); }
    [[ "$FILE" =~ ^proposals/approved/ ]] && { validate_assigned_to "$FILE" "proposal" || ((ERRORS++)); }
    if [[ "$FILE" =~ ^plans/[^/]+\.md$ ]] && [[ ! "$FILE" =~ ^plans/completed/ ]]; then
        validate_assigned_to "$FILE" "plan" || ((ERRORS++))
        validate_scenario_synthesis "$FILE" || ((ERRORS++))
    fi
    [[ "$FILE" =~ ^docs/SOPs/ ]] && { validate_agent_instructions "$FILE" || ((ERRORS++)); }
done

[ $ERRORS -gt 0 ] && print_error "Pre-commit validation failed with $ERRORS error(s)" && exit 1
[ $WARNINGS -gt 0 ] && print_warning "Pre-commit validation passed with $WARNINGS warning(s)"
print_status "Pre-commit validation passed"
exit 0
