
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// IMPORTANT: This service account is for DEMONSTRATION PURPOSES ONLY.
// In a real production application, you should manage your service account
// keys securely, for example, by using Google Cloud Secret Manager.
// DO NOT commit your service account keys to your version control.
const serviceAccount = {
  "type": "service_account",
  "project_id": "studio-9070259337-c267a",
  "private_key_id": "7f3ff5bd0598b0e1a3727035d90831c833cc0647",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDHqXHm2Re5swU+\nQEetYfEO9eotriLN2/YNpKJJfMJkRBVwONEMtMwViVj+LQUFDsnsoJ42kW997YZ2\nKsvp7/IGK2b9pEy5O+T5FuomKoG5BKeo/MOlQn2ouUV+b+RjWQ6jlqR91AGhuXp9\nFUx6GuEKMpwpMGSJxOKU3YU6M36B/+Glac4lO41koZTcbke2vp6q2JcEtv+d1SQ0\nXtTzqjDLj6w/hpkfbRF9L3RHcyy+7p7vS2TOdSrgCGknRkC91cXGN8NwNQaTGgWH\n94VZiU9ThkwgfOCqPn+exZ5Jy3wDtvjpuOOZhzr6rMHRAQAVHO9uDwHKkHHhIQwm\nSUThnkHzAgMBAAECggEAG432crHuNMoQhK1RVwvHvVVR2rkIA5oCJJLedL7bgwPk\nY4brztGawrQgTH/BDBgk5NurygMbPGlN37v7RU9Aevp9ba7BieTKrleru9Ws7nBG\nhStRAtsgxWrAPPlLLyzIuOnezKC4Eu4qid2pHsbb3NDsPUD49wxtarcBnm0h3eXI\nfDgt8RFBJw6LZRVhUTHBM+GaFgfB9sXbPLn/M4cDl4+ZGB/k9/5PTqj322q6kK58\n/GUvXjDapv0RWpQs0mD0Y8aZqcpAlimVGfrENK5U2t17a1PnrFzJvaRPgutTYh3y\n2APF9dyAvWeUjrzWPU9wSM/gxP/7DFtYxfiKb+sMXQKBgQDopePl4oZZPsvgZ6vx\n7rY6aSAAUtCQpeyl+kaSzf9Cow76svky9abLLTi4qJKxUVeS43ir/OBXKTl9eNsT\n9+OlqTCOlIZJswzkdnmaB/ZZPkhKws35C5UoINqSIXGly5PoYFLD7lnLHz5mNQ2K\nK3+LHx4LBGKki65YAusMzhD75wKBgQDbs/IGn9L1q8Qdcq9jVk2kOJWQEWPHs73s\nPoDuMgCayQMaJFmDqN4ylcFARdtYav+n3aAXh25zV3yWWnA65UkDPH0nLQ91Lq0n\nwrXF2/CFT/NJnlmNcr+HkaxZREclsy5uEeh+snsogQ9XOiXX3siGc11TThNrwjYH\ngAOP9oaoFQKBgQClgl8/jIhHtYUVgKuy0kCSDXfWwxPd1C0nZ4YNqr+OiLJ/aBQh\nTOH8aY+Qz1yNCXFj7rBKqvxvBcUAnpo8+n3ZvSPuS3u9ssPZRO/9xOxdURHdHfmq\n07KpebYFgAV6DfqLtvsqqMb42qFp1RRs18VFFD4rWFNU/Ipr0qel1HQAwQKBgQCS\nNnRIwk6kHpbavjtI0ePD+cBXa6tK+SzZL1OgsfhDCqmc2ToVa+nMImvE+XibpEHW\nFqF3ZzMzYbLRYQi1uWfY1oW3774Mz25/Oo68Sb4NCoMvqEmS4B3k/CaGFfF/fnrU\n1+gxgViDQTjTZShQPLyY9efTC+/S1CIe5av5QCinbQKBgQCseKZOM/RcRJj4atI3\nK54LBpPLknKDQefVGlt4wStoT/p0KT4OobS/S3pdgQT2O/bz0gJO0UiILoRrY1ku\nH6BtLqJiwmMDzBEruv9dVgl+DGCxZejzS0ZPq0mLHtMmEYw0klLSAlqYoBOCsYe4\nDYUVxkNDnt75TRoUSgYklaARRA==\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@studio-9070259337-c267a.iam.gserviceaccount.com",
  "client_id": "112477094850646595135",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40studio-9070259337-c267a.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};


const getAdminApp = (): App => {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  return initializeApp({
    credential: cert(serviceAccount),
  });
};

export const initializeAdminApp = () => {
    const app = getAdminApp();
    return {
        app,
        auth: getAuth(app),
        db: getFirestore(app)
    };
};
