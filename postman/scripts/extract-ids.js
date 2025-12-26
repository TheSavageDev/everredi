// Extract IDs from response and set environment variables
// This script can be used in test scripts for endpoints that return IDs

const jsonData = pm.response.json();

if (jsonData.success && jsonData.data) {
    // Extract kit ID
    if (jsonData.data.id && jsonData.data.name) {
        // Likely a kit
        pm.environment.set("test_kit_id", jsonData.data.id);
    }
    
    // Extract location ID
    if (jsonData.data.id && jsonData.data.locationType) {
        // Likely a location
        pm.environment.set("test_location_id", jsonData.data.id);
    }
    
    // Extract inventory ID
    if (jsonData.data.id && jsonData.data.supplyName) {
        // Likely an inventory item
        pm.environment.set("test_inventory_id", jsonData.data.id);
    }
    
    // Extract from array responses
    if (Array.isArray(jsonData.data) && jsonData.data.length > 0) {
        const firstItem = jsonData.data[0];
        if (firstItem.id) {
            // Set appropriate ID based on item type
            if (firstItem.locationType) {
                pm.environment.set("test_location_id", firstItem.id);
            } else if (firstItem.supplyName) {
                pm.environment.set("test_inventory_id", firstItem.id);
            } else if (firstItem.name && !firstItem.supplyName) {
                pm.environment.set("test_kit_id", firstItem.id);
            }
        }
    }
}

