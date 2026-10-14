import mammoth from 'mammoth'

export interface ParsedOpsi {
  label: string
  teks: string
  kunci: boolean
}

export interface ParsedSoal {
  nomor: number
  teks: string
  tipe: string
  bobot: number
  mapel: string
  kelas: string
  opsi: ParsedOpsi[]
}

export async function parseDocxToSoal(arrayBuffer: ArrayBuffer): Promise<ParsedSoal[]> {
  const result = await mammoth.extractRawText({ arrayBuffer })
  const text = result.value
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  let mapel = 'Technical Support I'
  let kelas = 'X-IPA-1'

  const parsedSoal: ParsedSoal[] = []
  let currentSoal: ParsedSoal | null = null
  let inBagianA = false

  for (const l of lines) {
    if (l.includes('BAGIAN A') || l.includes('PILIHAN GANDA')) {
      inBagianA = true
      continue
    }
    if (l.includes('BAGIAN B') || l.includes('BAGIAN C') || l.includes('URAIAN')) {
      inBagianA = false
      if (currentSoal) {
        parsedSoal.push(currentSoal)
        currentSoal = null
      }
      continue
    }

    if (inBagianA) {
      const qMatch = l.match(/^(\d+)[.)]\s+(.+)/)
      if (qMatch) {
        if (currentSoal) {
          parsedSoal.push(currentSoal)
        }
        currentSoal = {
          nomor: parseInt(qMatch[1], 10),
          teks: qMatch[2],
          tipe: 'PG',
          bobot: 10,
          mapel,
          kelas,
          opsi: [],
        }
        continue
      }

      const oMatch = l.match(/^([A-Da-d])[.)]\s+(.+)/)
      if (oMatch && currentSoal) {
        let label = oMatch[1].toUpperCase()
        let oText = oMatch[2]
        let isKunci = false
        if (oText.endsWith('*')) {
          isKunci = true
          oText = oText.replace(/\*$/, '').trim()
        }
        currentSoal.opsi.push({
          label,
          teks: oText,
          kunci: isKunci,
        })
      } else if (currentSoal && currentSoal.opsi.length === 0 && l.length > 0 && !l.startsWith('BAGIAN')) {
        currentSoal.teks += ' ' + l
      }
    }
  }

  if (currentSoal) {
    parsedSoal.push(currentSoal)
  }

  if (parsedSoal.length === 0) {
    for (const l of lines) {
      const qMatch = l.match(/^(\d+)[.)]\s+(.+)/)
      if (qMatch) {
        if (currentSoal) parsedSoal.push(currentSoal)
        currentSoal = {
          nomor: parseInt(qMatch[1], 10),
          teks: qMatch[2],
          tipe: 'PG',
          bobot: 10,
          mapel,
          kelas,
          opsi: [],
        }
        continue
      }
      const oMatch = l.match(/^([A-Da-d])[.)]\s+(.+)/)
      if (oMatch && currentSoal) {
        let label = oMatch[1].toUpperCase()
        let oText = oMatch[2]
        let isKunci = false
        if (oText.endsWith('*')) {
          isKunci = true
          oText = oText.replace(/\*$/, '').trim()
        }
        currentSoal.opsi.push({ label, teks: oText, kunci: isKunci })
      }
    }
    if (currentSoal) parsedSoal.push(currentSoal)
  }

  return parsedSoal
}
