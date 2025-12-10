#!/bin/sh

# ==========================================
# Color Definitions
# ==========================================
# We use octal escapes \033 for maximum portability with printf
RESET='\033[0m'
BOLD='\033[1m'
GRAY='\033[90m'

RED_BRIGHT='\033[91m'     # chalk.redBright
GREEN_BRIGHT='\033[92m'   # chalk.greenBright
YELLOW_BRIGHT='\033[93m'  # chalk.yellowBright
BLUE_BRIGHT='\033[94m'    # chalk.blueBright

# ==========================================
# Logging Functions
# ==========================================

log_info() {
  # Proposed Icon: ℹ or ℹ️
  printf "${BLUE_BRIGHT}${BOLD}INFO:${RESET} %s\n" "$1"
}

log_success() {
  # Proposed Icon: ✔ or ✅
  printf "${GREEN_BRIGHT}${BOLD}SUCCESS:${RESET} %s\n" "$1"
}

log_warn() {
  # Proposed Icon: ⚠ or ⚠️
  printf "${YELLOW_BRIGHT}${BOLD}WARN:${RESET} %s\n" "$1"
}

log_error() {
  # Proposed Icon: ✖ or ❌
  printf "${RED_BRIGHT}${BOLD}ERROR:${RESET} %s\n" "$1"
  # Check if 2nd argument exists and is not empty
  if [ -n "$2" ]; then
    exit "$2"
  fi
}

log_debug() {
  # Proposed Icon: ⚙ or ⚙️
  if [ $verbose = 1 ]; then
    printf "${GRAY}DEBUG: %s${RESET}\n" "$1"
  fi
}