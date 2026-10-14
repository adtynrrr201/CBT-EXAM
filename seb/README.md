# SEB — Safe Exam Browser (lockdown keras ujian resmi)

Web murni tidak bisa blokir situs lain 100%. Untuk UTS/UAS: wajib SEB.

## Cara pakai
1. Install SEB di tiap PC lab.
2. Backend generate config per ujian: URL `https://cbt.sekolah/ujian/:id?seb=1` + exam token + whitelist.
3. Siswa buka via SEB. Backend cek header SEB + `require_seb=true` → tolak browser biasa.
4. Setelah submit/logout, tutup SEB → browsing normal kembali.

## Contoh config (seb/template-seb.json)
```json
{
  "startURL": "https://cbt.sekolah/ujian/UTS-IPA-01?seb=1",
  "allowList": ["cbt.sekolah"],
  "blockList": ["*google*", "*youtube*", "*chatgpt*", "*wa*"],
  "requireFullscreen": true,
  "allowExit": false
}
```
