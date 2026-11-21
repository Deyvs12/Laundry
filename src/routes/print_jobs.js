import { Hono } from 'hono'
import { show, retry } from '../controllers/print_jobs.js'

const printJobsRoutes = new Hono()

printJobsRoutes.get('/print-jobs/:id', show)
printJobsRoutes.post('/print-jobs/:id/retry', retry)

export default printJobsRoutes
