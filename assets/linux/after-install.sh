#!/bin/bash
# Debian post-install script (electron-builder template: ${executable} and
# ${sanitizedProductName} are filled in at build time; do not use ${...} for
# shell variables here).

if type update-alternatives 2>/dev/null >&1; then
    # Remove previous link if it doesn't use update-alternatives
    if [ -L '/usr/bin/${executable}' -a -e '/usr/bin/${executable}' -a "`readlink '/usr/bin/${executable}'`" != '/etc/alternatives/${executable}' ]; then
        rm -f '/usr/bin/${executable}'
    fi
    update-alternatives --install '/usr/bin/${executable}' '${executable}' '/opt/${sanitizedProductName}/${executable}' 100 || ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'
else
    ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'
fi

# SUID chrome-sandbox for Electron 5+
chmod 4755 '/opt/${sanitizedProductName}/chrome-sandbox' || true

# Ubuntu 24.04+ blocks unprivileged user namespaces unless an AppArmor profile
# allows them. Without it Chromium falls back to the SUID sandbox, which cannot
# start from an install path containing spaces (the app never opens). Same kind
# of profile Ubuntu ships for Chrome and VS Code.
if [ -d /etc/apparmor.d ] && hash apparmor_parser 2>/dev/null; then
    PROFILE='/etc/apparmor.d/${executable}'
    cat > "$PROFILE" <<'PROFILE_EOF'
# Allows the Omnicore Markdown Viewer (Electron) to use user namespaces for its sandbox.
abi <abi/4.0>,
include <tunables/global>

profile ${executable} "/opt/${sanitizedProductName}/${executable}" flags=(unconfined) {
  userns,

  include if exists <local/${executable}>
}
PROFILE_EOF
    if apparmor_parser --skip-kernel-load --debug "$PROFILE" >/dev/null 2>&1; then
        apparmor_parser --replace --write-cache --skip-read-cache "$PROFILE" || true
    else
        echo "AppArmor does not support the bundled profile; skipping it" >&2
        rm -f "$PROFILE"
    fi
fi

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi

if hash gtk-update-icon-cache 2>/dev/null; then
    gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor || true
fi
