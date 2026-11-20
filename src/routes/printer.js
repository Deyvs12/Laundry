import { Hono } from 'hono'
import { index, test, testCommands } from '../controllers/printer.js'

const printerRoutes = new Hono()

printerRoutes.get('/printer', index)
printerRoutes.post('/printer/test', test)
printerRoutes.post('/printer/test-commands', testCommands)

export default printerRoutes
