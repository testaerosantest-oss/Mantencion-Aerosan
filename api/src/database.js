
const sql = require('mssql');
const { DefaultAzureCredential } = require('@azure/identity');

const server = process.env.SQL_SERVER || 'srmdata.database.windows.net';
const database = process.env.SQL_DATABASE || 'BDO-SRM';

let poolPromise;

async function getPool() {
  if (!poolPromise) {
    poolPromise = (async () => {
      const credential = new DefaultAzureCredential();

      const token = await credential.getToken(
        'https://database.windows.net/.default'
      );

      return sql.connect({
        server,
        database,
        options: {
          encrypt: true,
          trustServerCertificate: false
        },
        authentication: {
          type: 'azure-active-directory-access-token',
          options: {
            token: token.token
          }
        }
      });
    })().catch((error) => {
      poolPromise = null;
      throw error;
    });
  }

  return poolPromise;
}

module.exports = { sql, getPool };

