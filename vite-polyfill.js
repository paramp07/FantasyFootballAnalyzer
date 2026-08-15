import crypto from 'crypto';

if (typeof crypto.hash !== 'function') {
  crypto.hash = function(algorithm, data, outputEncoding) {
    return crypto.createHash(algorithm).update(data).digest(outputEncoding);
  };
}
