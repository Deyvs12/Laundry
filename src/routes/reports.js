import { Hono } from 'hono'
import { index, createBackup, downloadBackup } from '../controllers/reports.js'

const reportsRoutes = new Hono()

reportsRoutes.get('/reports', index)
reportsRoutes.post('/backups', createBackup)
reportsRoutes.get('/backups/:name', downloadBackup)

export default reportsRoutes
