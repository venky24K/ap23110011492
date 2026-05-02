require('dotenv').config();
const axios = require('axios');
const { Log } = require('../logging_middleware');

const BASE_URL = 'http://20.207.122.201/evaluation-service';
const config = {
    headers: {
        'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`
    }
};

const WEIGHTS = {
    'Placement': 3,
    'Result': 2,
    'Event': 1
};

/**
 * Calculates priority score based on weight and recency.
 * Using a large multiplier for weight to ensure it takes precedence over time.
 */
function calculateScore(notification) {
    const weight = WEIGHTS[notification.Type] || 0;
    const time = new Date(notification.Timestamp).getTime();
    return (weight * 1e13) + time;
}

async function fetchNotifications() {
    try {
        await Log('backend', 'info', 'service', 'Fetching notifications for priority inbox');
        const response = await axios.get(`${BASE_URL}/notifications`, config);
        return response.data.notifications;
    } catch (error) {
        await Log('backend', 'error', 'service', `Failed to fetch notifications: ${error.message.substring(0, 20)}`);
        return [];
    }
}

async function getTopNotifications(n = 10) {
    const notifications = await fetchNotifications();

    // Sort by calculated priority score descending
    const sorted = notifications.sort((a, b) => {
        return calculateScore(b) - calculateScore(a);
    });

    return sorted.slice(0, n);
}

async function runPriorityInbox() {
    console.log("=== Priority Inbox (Top 10) ===");
    const top10 = await getTopNotifications(10);

    top10.forEach((n, index) => {
        console.log(`${index + 1}. [${n.Type}] ${n.Message} (${n.Timestamp})`);
    });

    await Log('backend', 'info', 'service', `Priority Inbox displayed ${top10.length} items`);
}

runPriorityInbox();
