// Status code test
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// Response structure test
pm.test("Response has success field", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success');
    pm.expect(jsonData.success).to.be.true;
});

// Response time test
pm.test("Response time is less than 2000ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(2000);
});

// Data validation
pm.test("Response data matches schema", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('data');
    pm.expect(jsonData).to.have.property('timestamp');
    pm.expect(jsonData.timestamp).to.be.a('string');
});

// Extract ID for future requests
if (pm.response.json().data && pm.response.json().data.id) {
    pm.environment.set("test_kit_id", pm.response.json().data.id);
}

