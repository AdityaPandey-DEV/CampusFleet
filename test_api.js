const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/payments/approvals?studentId=stud-92f835ef-0a27-46c5-82f8-458e3bbbaec5',
  method: 'GET',
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
