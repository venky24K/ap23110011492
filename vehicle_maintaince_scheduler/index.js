require('dotenv').config();
const { Log } = require('../logging_middleware');

const vehicles = [
    { id: 1, lastServiceMileage: 5000, currentMileage: 10500, serviceInterval: 5000 },
    { id: 2, lastServiceMileage: 2000, currentMileage: 2500, serviceInterval: 5000 }
];

async function scheduleMaintenance(data) {
    await Log('backend', 'info', 'service', 'Starting maintenance check');
    
    try {
        for (const vehicle of data) {
            const mileageSinceService = vehicle.currentMileage - vehicle.lastServiceMileage;
            
            if (mileageSinceService >= vehicle.serviceInterval) {
                await Log('backend', 'info', 'service', `Vehicle ${vehicle.id} needs service`);
                console.log(`Vehicle ${vehicle.id}: Service Required (${mileageSinceService} miles)`);
            } else {
                await Log('backend', 'debug', 'service', `Vehicle ${vehicle.id} is healthy`);
                console.log(`Vehicle ${vehicle.id}: Healthy`);
            }
        }

        await Log('backend', 'info', 'service', 'Maintenance check completed');
    } catch (error) {
        await Log('backend', 'error', 'service', `Algorithm failed: ${error.message}`);
    }
}

scheduleMaintenance(vehicles);