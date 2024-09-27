import {auth} from "express-oauth2-jwt-bearer";
import jwksClient from "jwks-rsa";
import {authorize} from "@thream/socketio-jwt";
import {ManagementClient} from "auth0";
import {NextFunction, Response} from "express";

const authConfig = require('./auth_config.json');

// create the JWT middleware
export const checkJwt = auth({
    audience: authConfig.audience,
    issuerBaseURL: `https://${authConfig.domain}`
});

const jwksClient1 = jwksClient({
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
})

const authPayload = {
    domain: process.env.AUTH0_DOMAIN || '',
    clientId: process.env.AUTH0_CLIENT_ID || '',
    clientSecret: process.env.AUTH0_MANAGEMENT_SECRET,
    scope: 'read:users'
}
const management = new ManagementClient(authPayload);

export function authIoMiddleware() {
    return authorize({
        secret: async (decodedToken) => {
            const key = await jwksClient1.getSigningKey(decodedToken.header.kid)
            return key.getPublicKey()
        },
        algorithms: ['RS256'],
        onAuthentication: async decodedToken => {

            const user = await management.getUser({
                id: decodedToken.sub
            })
            return user;
        }
    })
}

export function unauthorizeEndMiddleware() {
    return function (err: any, req: Request, res: Response, next: NextFunction) {
        if (err.name === "UnauthorizedError") {
            return res.status(401).send({msg: "Invalid token"});
        }
        // @ts-ignore
        next(err, req, res);
    }
}
