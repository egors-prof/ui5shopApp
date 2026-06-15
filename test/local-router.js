const approuter = require('@sap/approuter');

process.env.destinations = '[{"name":"srv-api","url":"https://f37788detrial-dev-crm-project.cfapps.us10-001.hana.ondemand.com","forwardAuthToken":true}]';

const ar = approuter();
ar.start();
console.log('AppRouter started on port 5000');