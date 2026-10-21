
const { app } = require('@azure/functions');
const { getPool } = require('../database');

app.http('estado', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: async () => {
    try {
      const pool = await getPool();

      const result = await pool.request().query(`
        SELECT TABLE_SCHEMA, TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_SCHEMA, TABLE_NAME
      `);

      return {
        status: 200,
        jsonBody: {
          servicio: 'API Mantenimiento Aerosan',
          estado: 'conectado',
          baseDatos: 'BDO-SRM',
          tablas: result.recordset
        }
      };
    } catch (error) {
      console.error('Error al conectar con Azure SQL:', error.message);

      return {
        status: 500,
        jsonBody: {
          servicio: 'API Mantenimiento Aerosan',
          estado: 'error',
          mensaje: error.message
        }
      };
    }
  }
});
