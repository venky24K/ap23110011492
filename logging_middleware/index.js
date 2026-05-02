const axios = require('axios');

/**
 * @param {string} stack 
 * @param {string} level 
 * @param {string} pkg 
 * @param {string} message 
 */
async function Log(stack, level, pkg, message) {
    const config = {
        headers: {
            'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
        }
    };

    const body = {
        stack: stack.toLowerCase(),
        level: level.toLowerCase(),
        package: pkg.toLowerCase(),
        message: message
    };

    try {
        const response = await axios.post('http://20.207.122.201/evaluation-service/logs', body, config);
        return response.data;
    } catch (err) {
        console.error("Logging failed:", err.response?.data || err.message);
    }
}

module.exports = { Log };