#!/usr/bin/env zsh
set -euo pipefail

sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}"

if [[ ! -d "$sdk_root" ]]; then
  sdk_root="$HOME/Library/Android/sdk"
fi

java_home_path=""
if [[ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]]; then
  java_home_path="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
elif /usr/libexec/java_home >/dev/null 2>&1; then
  java_home_path="$(/usr/libexec/java_home)"
fi

ndk_home_path=""
if [[ -d "$sdk_root/ndk" ]]; then
  latest_ndk="$(find "$sdk_root/ndk" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"
  if [[ -n "${latest_ndk:-}" ]]; then
    ndk_home_path="$latest_ndk"
  fi
fi

print_exports() {
  echo "export ANDROID_SDK_ROOT=\"$sdk_root\""
  echo "export ANDROID_HOME=\"$sdk_root\""
  if [[ -n "$java_home_path" ]]; then
    echo "export JAVA_HOME=\"$java_home_path\""
  fi
  if [[ -n "$ndk_home_path" ]]; then
    echo "export NDK_HOME=\"$ndk_home_path\""
  fi
  if [[ -d "$sdk_root/platform-tools" ]]; then
    echo "export PATH=\"$sdk_root/platform-tools:\$PATH\""
  fi
  if [[ -d "$sdk_root/cmdline-tools/latest/bin" ]]; then
    echo "export PATH=\"$sdk_root/cmdline-tools/latest/bin:\$PATH\""
  elif [[ -d "$sdk_root/cmdline-tools" ]]; then
    first_cmdline="$(find "$sdk_root/cmdline-tools" -mindepth 1 -maxdepth 1 -type d | sort | head -n 1)"
    if [[ -n "${first_cmdline:-}" && -d "$first_cmdline/bin" ]]; then
      echo "export PATH=\"$first_cmdline/bin:\$PATH\""
    fi
  fi
  if [[ -d "$sdk_root/tools/bin" ]]; then
    echo "export PATH=\"$sdk_root/tools/bin:\$PATH\""
  fi
}

persist_to_zshrc() {
  zshrc_file="$HOME/.zshrc"
  start_marker="# >>> tauri-android-env >>>"
  end_marker="# <<< tauri-android-env <<<"
  temp_file="$(mktemp)"
  if [[ -f "$zshrc_file" ]]; then
    awk -v start="$start_marker" -v end="$end_marker" '
      BEGIN { skip=0 }
      $0==start { skip=1; next }
      $0==end { skip=0; next }
      skip==0 { print }
    ' "$zshrc_file" > "$temp_file"
  fi
  {
    cat "$temp_file"
    echo "$start_marker"
    print_exports
    echo "$end_marker"
  } > "$zshrc_file"
  rm -f "$temp_file"
  echo "已写入 $zshrc_file"
}

if [[ "${1:-}" == "--print" ]]; then
  print_exports
  exit 0
fi

if [[ "${1:-}" == "--persist" ]]; then
  persist_to_zshrc
  exit 0
fi

if [[ "${ZSH_EVAL_CONTEXT:-}" == *:file ]]; then
  eval "$(print_exports)"
  echo "ANDROID_SDK_ROOT=$ANDROID_SDK_ROOT"
  if [[ -n "${JAVA_HOME:-}" ]]; then
    echo "JAVA_HOME=$JAVA_HOME"
  fi
  if [[ -n "${NDK_HOME:-}" ]]; then
    echo "NDK_HOME=$NDK_HOME"
  fi
  exit 0
fi

echo "请使用以下任一方式："
echo "1) source ./scripts/android-env.zsh"
echo "2) eval \"\$(zsh ./scripts/android-env.zsh --print)\""
echo "3) zsh ./scripts/android-env.zsh --persist"
