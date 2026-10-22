```javascript
const { app } = require('@azure/functions');
const { sql, getPool } = require('../database');

app.http('equipos', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'equipos',

  handler: async (request, context) => {
    try {
      context.log('Iniciando solicitud de API equipos');

      const pool = await getPool();

      // CONSULTAR EQUIPOS
      if (request.method === 'GET') {
        context.log('Consultando tabla dbo.Equipos');

        const result = await pool.request().query(`
          SELECT
            EquipoID,
            Codigo,
            Nombre,
            Ubicacion,
            Sector,
            Estado,
            FechaRegistro
          FROM dbo.Equipos
          ORDER BY EquipoID DESC;
        `);

        context.log(
          `Consulta completada. Equipos encontrados: ${result.recordset.length}`
        );

        return {
          status: 200,
          jsonBody: result.recordset
        };
      }

      // REGISTRAR EQUIPO NUEVO
      if (request.method === 'POST') {
        context.log('Registrando equipo nuevo');

        let body;

        try {
          body = await request.json();
        } catch {
          return {
            status: 400,
            jsonBody: {
              error: 'El cuerpo de la solicitud debe contener JSON válido.'
            }
          };
        }

        const {
          Codigo,
          Nombre,
          Ubicacion,
          Sector,
          Estado
        } = body || {};

        if (
          typeof Codigo !== 'string' ||
          !Codigo.trim() ||
          typeof Nombre !== 'string' ||
          !Nombre.trim()
        ) {
          return {
            status: 400,
            jsonBody: {
              error: 'Los campos Codigo y Nombre son obligatorios.'
            }
          };
        }

        const result = await pool.request()
          .input('Codigo', sql.NVarChar, Codigo.trim())
          .input('Nombre', sql.NVarChar, Nombre.trim())
          .input(
            'Ubicacion',
            sql.NVarChar,
            Ubicacion != null && String(Ubicacion).trim()
              ? String(Ubicacion).trim()
              : null
          )
          .input(
            'Sector',
            sql.NVarChar,
            Sector != null && String(Sector).trim()
              ? String(Sector).trim()
              : null
          )
          .input(
            'Estado',
            sql.NVarChar,
            Estado != null && String(Estado).trim()
              ? String(Estado).trim()
              : 'Activo'
          )
          .query(`
            INSERT INTO dbo.Equipos
              (Codigo, Nombre, Ubicacion, Sector, Estado)
            OUTPUT
              INSERTED.EquipoID,
              INSERTED.Codigo,
              INSERTED.Nombre,
              INSERTED.Ubicacion,
              INSERTED.Sector,
              INSERTED.Estado,
              INSERTED.FechaRegistro
            VALUES
              (@Codigo, @Nombre, @Ubicacion, @Sector, @Estado);
          `);

        const equipoCreado = result.recordset[0];

        context.log(
          `Equipo registrado. ID: ${equipoCreado.EquipoID}`
        );

        return {
          status: 201,
          jsonBody: equipoCreado
        };
      }

      return {
        status: 405,
        jsonBody: {
          error: 'Método HTTP no permitido.'
        }
      };

    } catch (error) {
      context.error('Error en API equipos:', {
        message: error.message,
        code: error.code,
        number: error.number,
        state: error.state
      });

      return {
        status: 500,
        jsonBody: {
          error: 'No se pudo procesar la solicitud de equipos.',
          detalle: error.message,
          codigo: error.code || null
        }
      };
    }
  }
});
```
