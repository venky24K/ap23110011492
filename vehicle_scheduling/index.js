require('dotenv').config();
const axios = require('axios');
const { Log } = require('../logging_middleware');

const BASE_URL = 'http://20.207.122.201/evaluation-service';
const config = {
    headers: {
        'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
    }
};

/**
 * @param {Array} tasks 
 * @param {number} capacity 
 */

function solveKnapsack(tasks, capacity) {
    const n = tasks.length;
    const dp = Array.from({ length: n + 1 }, () => Array(capacity + 1).fill(0));

    for (let i = 1; i <= n; i++) {
        const { Duration, Impact } = tasks[i - 1];
        for (let w = 0; w <= capacity; w++) {
            if (Duration <= w) {
                dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - Duration] + Impact);
            } else {
                dp[i][w] = dp[i - 1][w];
            }
        }
    }

    let res = dp[n][capacity];
    let w = capacity;
    const selectedTasks = [];
    for (let i = n; i > 0 && res > 0; i--) {
        if (res !== dp[i - 1][w]) {
            selectedTasks.push(tasks[i - 1]);
            res -= tasks[i - 1].Impact;
            w -= tasks[i - 1].Duration;
        }
    }

    return {
        totalImpact: dp[n][capacity],
        selectedTasks: selectedTasks
    };
}

async function fetchDepots() {
    try {
        await Log('backend', 'info', 'service', 'Fetching depot data');
        const response = await axios.get(`${BASE_URL}/depots`, config);
        await Log('backend', 'info', 'service', `Fetched ${response.data.depots.length} depots`);
        return response.data.depots;
    } catch (error) {
        await Log('backend', 'error', 'service', `Depot fetch failed: ${error.message.substring(0, 20)}`);
        throw error;
    }
}

async function fetchTasks() {
    try {
        await Log('backend', 'info', 'service', 'Fetching task data');
        const response = await axios.get(`${BASE_URL}/vehicles`, config);
        await Log('backend', 'info', 'service', `Fetched ${response.data.vehicles.length} tasks`);
        return response.data.vehicles;
    } catch (error) {
        await Log('backend', 'error', 'service', `Task fetch failed: ${error.message.substring(0, 20)}`);
        throw error;
    }
}

async function runScheduler() {
    await Log('backend', 'info', 'service', 'Service execution started');

    try {
        const depots = await fetchDepots();
        const tasks = await fetchTasks();

        for (const depot of depots) {
            console.log(`\nProcessing Depot ${depot.ID} (Hours: ${depot.MechanicHours})`);
            await Log('backend', 'info', 'service', `Processing Depot ${depot.ID}`);

            const result = solveKnapsack(tasks, depot.MechanicHours);

            console.log(`> Max Operational Impact: ${result.totalImpact}`);
            console.log(`> Tasks Selected: ${result.selectedTasks.length}`);
            await Log('backend', 'info', 'service', `Depot ${depot.ID} Max Impact: ${result.totalImpact}`);

            const taskIds = result.selectedTasks.map(t => t.TaskID.substring(0, 4)).join(',');
            await Log('backend', 'debug', 'service', `Depot ${depot.ID} Tasks: ${taskIds.substring(0, 30)}`);
        }

        console.log("\nService execution completed successfully.");
        await Log('backend', 'info', 'service', 'Service execution completed');
    } catch (error) {
        await Log('backend', 'error', 'service', `Scheduler failed: ${error.message.substring(0, 25)}`);
    }
}

runScheduler();
