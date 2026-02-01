
/* requires smartquotes.js */

var text = {

    trim: function (str) {
        return String(str).replace(/\s+/g, " ").trim();
    },

    toLowerCase: function (str) {
        return String(str).toLowerCase();
    },

    toCamelCase: function (str) {
        return String(str).replace(/\w\S*/g, function (txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    },

    toUpperCase: function (str) {
        return String(str).toUpperCase();
    },

    escapeRegExp: function (str) {
        return String(str).replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    },

    replace: function (str, find, repl) {
        return String(str).replace(new RegExp(text.escapeRegExp(find), 'g'), repl);
    },

    smartQuotes: function (str) {
        return smartquotes(String(str));
    }

};
