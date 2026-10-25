#!/usr/bin/env bash
# Owner-run macOS transfer preparation. Original archive/dumps are read-only.
set -euo pipefail
umask 077
if [[ "${1:-}" != '--prepare-portable-backup' || "$#" != 1 ]]; then
  printf 'Usage: bash portable-backup-macos.sh --prepare-portable-backup\n' >&2
  exit 2
fi
if [[ "$(uname -s)" != Darwin ]]; then
  printf 'This preparation script requires macOS. It has not accessed the backup.\n' >&2
  exit 2
fi
case "$(uname -m)" in
  arm64)
    potok_age_arch=arm64
    potok_age_sha=e2020b073c44f692685a24d6abc378817eb81ffaaf49fd0531ef8565f767f2f5
    ;;
  x86_64)
    potok_age_arch=amd64
    potok_age_sha=1d1e4bc66e1427edad7739ae7616157de0e79db8b6d2a1497d7d9925fb06a539
    ;;
  *) printf 'Unsupported Mac architecture.\n' >&2; exit 2 ;;
esac
potok_name=POTOK_BACKUP_2026-10-24
potok_source="$HOME/$potok_name.tar.gz"
potok_manifest="$HOME/$potok_name.tar.gz.sha256"
cd "$HOME/$potok_name"
[[ -f "$potok_source" && -f "$potok_manifest" ]]
# The owner's original manifest was generated from inside the backup directory.
shasum -a 256 -c "$potok_manifest"
potok_expected="$(awk 'NR==1{print $1}' "$potok_manifest")"
[[ "$potok_expected" =~ ^[0-9a-f]{64}$ ]]
potok_work="$(mktemp -d "$HOME/POTOK_PORTABLE_2026-10-24.XXXXXX")"
potok_tools="$potok_work/temporary-age-tool"
mkdir "$potok_tools"
trap 'rm -rf -- "$potok_tools"' EXIT
printf 'Папка для переносимой копии: %s\n' "$potok_work"
cd "$potok_tools"
curl --fail --location --proto '=https' --connect-timeout 20 --max-time 600 \
  "https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-darwin-$potok_age_arch.tar.gz" \
  -o age-tool.tar.gz
printf '%s  age-tool.tar.gz\n' "$potok_age_sha" | shasum -a 256 -c -
tar -xzf age-tool.tar.gz age/age
potok_age="$potok_tools/age/age"
potok_cipher="$potok_work/$potok_name.tar.gz.age"
printf '\nВведите свой длинный пароль и повторите его. Не оставляйте поле пустым.\n'
printf 'Символы пароля не отображаются. Сохраните пароль отдельно; не отправляйте его в чат.\n'
"$potok_age" --passphrase --output "$potok_cipher" "$potok_source"
printf '\nПроверка расшифровки: введите тот же пароль ещё раз.\n'
potok_actual="$("$potok_age" --decrypt "$potok_cipher" | shasum -a 256 | awk '{print $1}')"
if [[ "$potok_actual" != "$potok_expected" ]]; then
  printf 'Проверка не пройдена. Переносимая копия не подтверждена.\n' >&2
  exit 1
fi
cd "$potok_work"
shasum -a 256 "$potok_name.tar.gz.age" > "$potok_name.tar.gz.age.sha256"
printf '%s  %s.tar.gz\n' "$potok_expected" "$potok_name" > "$potok_name.tar.gz.sha256"
cat > RESTORE_README.txt <<'README'
POTOK: encrypted logical backup from 2026-10-24.
Copy this whole folder to owner-controlled external storage or a private cloud.
The password must be retained separately. The original Mac/Docker is not needed
for decryption: age supports Windows, Linux and macOS.

Official tool and downloads: https://age-encryption.org/
Encryption used age v1.3.2, standard passphrase mode.

Decrypt with an installed age executable (the command prompts for the password):
age --decrypt --output POTOK_BACKUP_2026-10-24.tar.gz POTOK_BACKUP_2026-10-24.tar.gz.age

On macOS/Linux, from this copied folder, verify the ciphertext before decryption:
shasum -a 256 -c POTOK_BACKUP_2026-10-24.tar.gz.age.sha256
Then verify the decrypted archive:
shasum -a 256 -c POTOK_BACKUP_2026-10-24.tar.gz.sha256

The archive contains roles/schema/data SQL, the original SQL checksum manifest,
row-count verification, Storage files and their manifests/hashes. It does not
contain a complete Docker VM, hosted provider settings or every app service.
The SQL restore and Storage key/size checks were previously verified; this
transfer check establishes encryption/decryption byte equality to the original
archive, not a new full application restore. See POTOK security PRs 190-192.
README
printf '\nPORTABLE_BACKUP_VERIFIED\n'
printf 'Проверена расшифровка в исходный архив. Теперь скопируйте всю папку за пределы Mac:\n%s\n' "$potok_work"
open "$potok_work"
