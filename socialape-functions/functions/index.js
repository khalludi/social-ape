const functions = require('firebase-functions');
const admin = require('firebase-admin');
const app = require('express')();

require('dotenv').config({ path: __dirname+"/../.env" });
admin.initializeApp();

var firebaseConfig = {
    apiKey: process.env.API_KEY,
    authDomain: "socialape-fdee8.firebaseapp.com",
    databaseURL: "https://socialape-fdee8.firebaseio.com",
    projectId: "socialape-fdee8",
    storageBucket: "socialape-fdee8.appspot.com",
    messagingSenderId: "516977902573",
    appId: "1:516977902573:web:ab6b925b2d989f7d4b9de4"
};


const firebase = require('firebase');
firebase.initializeApp(firebaseConfig);

const db = admin.firestore();

app.get('/screams', (req, res) => {
    db
        .collection('screams')
        .orderBy('createdAt', 'desc')
        .get()
        .then((data) => {
            let screams = [];
            data.forEach((doc) => {
                screams.push({
                    screamId: doc.id,
                    body: doc.data().body,
                    userHandle: doc.data().userHandle,
                    createdAt: doc.data().createdAt
                });
            });
            return res.json(screams);
        })
        .catch(err => console.error(err));
})

const FBAuth = (req, res, next) => {
    let idToken;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        idToken = req.headers.authorization.split('Bearer ')[1];
    } else {
        console.error('No token found');
        return res.status(403).json({ error: 'Unauthorized' });
    }

    admin.auth().verifyIdToken(idToken)
        .then(decodedToken => {
            req.user = decodedToken;
            console.log(decodedToken);
            return db.collection('users')
                .where('userId', '==', req.user.uid)
                .limit(1)
                .get();
        })
        .then(data => {
            req.user.handle = data.docs[0].data().handle;
            return next();
        })
        .catch(err => {
            console.error('Error while verifying token ', err);
            return res.status(403).json(err);
        });
}

// Post one scream
app.post('/scream', FBAuth, (req, res) => {
    if (req.body.body.trim() === '') {
        return res.status(400).json({ body: 'Body must not be empty' });
    }
    
    const newScream = {
        body: req.body.body,
        userHandle: req.user.handle,
        createdAt: new Date().toISOString()
    };

    db
        .collection('screams')
        .add(newScream)
        .then(doc => {
            res.json({ message: `document ${doc.id} created successfully`});
        })
        .catch(err => {
            res.status(500).json({ error: 'Something went wrong!'});
            console.error(err);
        })
})

const isEmail = (email) => {
    const regEx = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;
    if(email.match(regEx)) return true;
    else return false;
}

const isEmpty = (string) => {
    if (string.trim() === '') return true;
    else return false;
};

// Signup route
app.post('/signup', (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle,
    }

    let errors = {};

    if(isEmpty(newUser.email)) {
        errors.email = 'Must not be empty';
    } else if (!isEmail(newUser.email)) {
        errors.email = 'Must be a valid email address';
    }

    if(isEmpty(newUser.password)) errors.password = 'Must not be empty';
    if(newUser.password !== newUser.confirmPassword) errors.confirmPassword = 'Passwords must match';
    if(isEmpty(newUser.handle)) errors.handle = 'Must not be empty';

    if (Object.keys(errors).length > 0) return res.status(400).json(errors);

    // TODO: validate data
    let token, userId;
    db.doc(`/users/${newUser.handle}`).get()
        .then(doc => {
            if (doc.exists) {
                return res.status(400).json({ handle: 'this handle is already taken'});
            } else {
                return firebase
                    .auth()
                    .createUserWithEmailAndPassword(newUser.email, newUser.password);
            }
        })
        .then(data => {
            userId = data.user.uid;
            return data.user.getIdToken();
        })
        .then(idToken => {
            token = idToken;
            const userCredentials = {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                userId
            };
            return db.doc(`/users/${newUser.handle}`).set(userCredentials);
        })
        .then(() => {
            return res.status(201).json({ token });
        })
        .catch(err => {
            console.error(err);
            if(err.code === "auth/email-already-in-use") {
                return res.status(400).json({ email: 'Email is already in use' });
            } else {
                return res.status(500).json({ error: err.code });
            }
        })
})

app.post('/login', (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    };

    let errors = {};
    
    if (isEmpty(user.email)) errors.email = 'Must not be empty';
    if (isEmpty(user.password)) errors.password = 'Must not be empty';

    if(Object.keys(errors).length > 0) return res.status(400).json(errors);

    firebase.auth().signInWithEmailAndPassword(user.email, user.password)
        .then(data => {
            return data.user.getIdToken();
        })
        .then(token => {
            return res.json({ token });
        })
        .catch(err => {
            console.error(err);
            if (err.code === 'auth/wrong-password') {
                return res.status(403).json({ general: 'Wrong credentials, please try again' });
            } else return res.status(500).json({ error: err.code })
        })
})

exports.api = functions.region('us-east4').https.onRequest(app);