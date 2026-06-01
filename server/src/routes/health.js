import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'

const router = Router()
const execAsync = promisify(exec)

async function readHwmon() {
  try {
    const base = '/sys/class/hwmon'
    const dirs = await fs.readdir(base)
    const sensors = []

    for (const dir of dirs) {
      const dirPath = `${base}/${dir}`
      let adapterName = dir
      try {
        adapterName = (await fs.readFile(`${dirPath}/name`, 'utf8')).trim()
      } catch {}

      let files = []
      try { files = await fs.readdir(dirPath) } catch { continue }

      // Températures
      for (const f of files.filter(f => /^temp\d+_input$/.test(f))) {
        try {
          const celsius = parseInt((await fs.readFile(`${dirPath}/${f}`, 'utf8')).trim()) / 1000
          if (celsius <= 0 || celsius >= 150) continue

          let label = f.replace('_input', '')
          const labelFile = f.replace('_input', '_label')
          if (files.includes(labelFile)) {
            try { label = (await fs.readFile(`${dirPath}/${labelFile}`, 'utf8')).trim() } catch {}
          }

          let crit = null
          const critFile = f.replace('_input', '_crit')
          if (files.includes(critFile)) {
            try { crit = parseInt((await fs.readFile(`${dirPath}/${critFile}`, 'utf8')).trim()) / 1000 } catch {}
          }

          sensors.push({ adapter: adapterName, label, celsius, crit })
        } catch {}
      }

      // Ventilateurs
      for (const f of files.filter(f => /^fan\d+_input$/.test(f))) {
        try {
          const rpm = parseInt((await fs.readFile(`${dirPath}/${f}`, 'utf8')).trim())
          let label = f.replace('_input', '')
          const labelFile = f.replace('_input', '_label')
          if (files.includes(labelFile)) {
            try { label = (await fs.readFile(`${dirPath}/${labelFile}`, 'utf8')).trim() } catch {}
          }
          sensors.push({ adapter: adapterName, label, rpm })
        } catch {}
      }
    }

    return sensors.length ? sensors : null
  } catch {
    return null
  }
}

async function readDisk() {
  try {
    const { stdout } = await execAsync("df -BM / --output=size,used,avail,pcent 2>/dev/null | tail -1")
    const parts = stdout.trim().split(/\s+/)
    return {
      totalMb: parseInt(parts[0]),
      usedMb: parseInt(parts[1]),
      availMb: parseInt(parts[2]),
      percent: parseInt(parts[3]),
    }
  } catch {
    return null
  }
}

async function readProcesses() {
  try {
    const { stdout } = await execAsync("ps aux --sort=-%cpu 2>/dev/null | tail -n +2 | head -6")
    return stdout.trim().split('\n').map(line => {
      const parts = line.trim().split(/\s+/)
      return {
        user: parts[0],
        pid: parseInt(parts[1]),
        cpu: parseFloat(parts[2]),
        mem: parseFloat(parts[3]),
        command: parts.slice(10).join(' ').substring(0, 60),
      }
    }).filter(p => p.pid)
  } catch {
    return []
  }
}

async function readServices() {
  try {
    const { stdout } = await execAsync(
      "systemctl is-active enclume-server enclume-client 2>/dev/null; true"
    )
    const lines = stdout.trim().split('\n')
    return {
      'enclume-server': lines[0]?.trim() || 'unknown',
      'enclume-client': lines[1]?.trim() || 'unknown',
    }
  } catch {
    return null
  }
}

router.get('/', requireAuth, async (req, res) => {
  const totalMem = os.totalmem()
  const freeMem = os.freemem()

  const [hwmon, disk, processes, services] = await Promise.all([
    readHwmon(),
    readDisk(),
    readProcesses(),
    readServices(),
  ])

  res.json({
    uptime: os.uptime(),
    memory: {
      totalMb: Math.round(totalMem / 1024 / 1024),
      usedMb: Math.round((totalMem - freeMem) / 1024 / 1024),
      freeMb: Math.round(freeMem / 1024 / 1024),
    },
    cpu: {
      model: os.cpus()[0]?.model || 'Unknown',
      count: os.cpus().length,
      speedMhz: os.cpus()[0]?.speed || 0,
    },
    loadAvg: os.loadavg(),
    disk,
    hwmon,
    processes,
    services,
  })
})

export default router
