function generatePasscode() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';

    let passcode = '';
    // 4 letters
    for (let i = 0; i < 4; i++) {
        passcode += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    // 4 numbers
    for (let i = 0; i < 4; i++) {
        passcode += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }

    return passcode;
}

module.exports = { generatePasscode };
