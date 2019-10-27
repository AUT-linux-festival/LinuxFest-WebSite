const jwt = require('jsonwebtoken');
const User = require('../src/models/User');

async function autCheckUser(req) {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded._id, 'tokens.token': token });

        if (!user) {
            return false;
        }

        req.token = token;
        req.user = user;
        return true
    } catch (error) {
        return false;
    }
}

const userAuth = async (req, res, next) => {
        if (await authCheckUser(req)) {
            next();
        } else {
            res.status(401).send('Please authenticate');
        }
}

module.exports = userAuth;