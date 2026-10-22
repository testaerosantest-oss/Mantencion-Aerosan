
const { app } = require('@azure/functions');
const { getPool } = require('../database');

app.http('mantenciones', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'mantenciones',
  handler: async (request, context) => {
    try {
      const pool = await getPool();

      const result = await pool.request().query(`
        SELECT *
        FROM dbo.Mantenciones
        ORDER BY MantencionID DESC
      `);

      return {
        status: 200,
        jsonBody: result.recordset
      };
    } catch (error) {
      context.error('Error consultando mantenciones:', error);

      return {
        status: 500,
        jsonBody: { error: 'No se pudieron consultar las mantenciones.' }
      };
    }
  }
});
