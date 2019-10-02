module.exports.camelize = (str, separator = ' ') => {
    let newstr = ''
    let upperCasePls = false
    for (let i = 0; i < str.length; i++) {
        let char = str.charAt(i)
        if (char === separator) {
            upperCasePls = true
        }
        else {
            newstr += upperCasePls ? char.toUpperCase() : char
            upperCasePls = false
        }
    }
    return newstr
}