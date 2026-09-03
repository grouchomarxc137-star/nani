// Generates a VAPID keypair for Web Push. Run: npm run vapid
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('\nAdd these to your .env (server) — keep the private key secret:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:you@example.com\n');
