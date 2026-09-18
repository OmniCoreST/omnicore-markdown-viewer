#!/bin/bash
# Debian post-remove script (electron-builder template, see after-install.sh).

# Delete the link to the binary
if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove '${executable}' '/usr/bin/${executable}'
else
    rm -f '/usr/bin/${executable}'
fi

# Remove the AppArmor profile on uninstall (not on upgrade)
if [ "$1" = "remove" ] || [ "$1" = "purge" ]; then
    PROFILE='/etc/apparmor.d/${executable}'
    if [ -f "$PROFILE" ]; then
        if hash apparmor_parser 2>/dev/null; then
            apparmor_parser --remove "$PROFILE" >/dev/null 2>&1 || true
        fi
        rm -f "$PROFILE"
    fi
fi
