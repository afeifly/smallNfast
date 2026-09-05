
var chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

exports.generateMixedWithoutCheckExist = (n) => {
    var res = "";
    for (var i = 0; i < n; i++) {
        var id = Math.ceil(Math.random() * 9);
        res += chars[id];
        // if (i == 3 || i == 7 || i == 11) {
        //     res += "-";
        // }
    }
    return res;
}