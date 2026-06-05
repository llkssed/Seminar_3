import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { askGigaChat } from './gigachat.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(cors())
app.use(express.json())

app.use(express.static(path.join(__dirname, '../public')))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'))
})

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Сообщение пустое' })
    }

    const reply = await askGigaChat(message)
    res.json({ reply })
  } catch (error) {
    console.error('--- GigaChat error ---')
    console.error('message:', error.message)
    console.error('status:', error.response?.status)
    console.error('data:', error.response?.data)
    console.error('----------------------')

    res.status(500).json({
      error: error.response?.data?.message || error.message || 'Ошибка при обращении к GigaChat'
    })
  }
})

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`)
})