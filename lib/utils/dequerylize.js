const Op = require('sequelize').Op
/**
 * @author N4cho!
 * @description 
 * Toma los datos de un query y los devuelve en el formato apropiado para las consultas de sequelize
 * _________________________________________________________________________________________________
 * - fields: _Campos que devolvera la consulta_
 * _________________________________________________________________________________________________
 * - limit: _Cantidad de elementos_
 * _________________________________________________________________________________________________
 * - offset: _Posicion del primer elemento_
 * _________________________________________________________________________________________________
 * - order_by: _campos por los que se debe ordenar_
 * _________________________________________________________________________________________________
 * - exclusive: _and o or_
 * _________________________________________________________________________________________________
 * @param {*} query 
 * @param {*} fieldmap 
 */
function dequerylize (query, fieldmap) {
    let exclusive = false
    let out = {}
    out.where = {}
    out.expand = query.expand === 'true' ? true : false
    out.basic = query.basic === 'true' ? true : false
    out.fields = fieldmap
    for (let key in query) {
        switch (key) {
        case 'fields': {
            let {fields, expand} = genFields(query[key], fieldmap)
            out.fields = fields
            out.expand = expand
            break
        }
        case 'limit': {
            out.limit = parseInt(query[key], 10)
            if (isNaN(out.limit)) {
                out.limit = undefined
            }
            break
        }
        case 'offset': {
            out.offset = parseInt(query[key], 10)
            if (isNaN(out.offset)) {
                out.offset = undefined
            }
            break
        }
        case 'order_by': {				
            const order = query[key].split(',')
            out.order = []
            const regex = /\(([^\)]+)\)/g
            for (let text of order) {					
                let sentido = regex.exec(text)
                if (sentido !== null) {
                    sentido = sentido[1]
                }
                else {
                    sentido = 'asc'
                }
                let field = text.replace(regex, '')
                let modelField = fieldmap.find(x => x.as === field)
                if (modelField) {
                    out.order.push([modelField.key, sentido.toUpperCase()])
                }
                if (out.order.length === 0) {
                    out.order = undefined
                }
            }				
            break
        }
        case 'exclusive':
            if(query[key] === 'true'){
                exclusive = true
            }
            else{
                exclusive = false
            }
            break

        }
    }

    out.where = genSequelizeQuery(query,fieldmap,exclusive)

    return out
}

function procDequerylize(query, entries, outies){
    let out = {}
    out.where = {}
    out.expand = query.expand === 'true' ? true : false
    out.basic = query.basic === 'true' ? true : false
    out.fields = fieldmap
    for (let key in query) {
        switch (key) {
        case 'fields': {
            let {fields, expand} = genFields(query[key], outies)
            out.fields = fields
            out.expand = expand
            break
        }
        case 'limit': {

            out.limit = parseInt(query[key], 10)
            if (isNaN(out.limit)) {
                out.limit = undefined
            }
            break
        }
        case 'offset': {
            out.offset = parseInt(query[key], 10)
            if (isNaN(out.offset)) {
                out.offset = undefined
            }
            break
        }
        case 'order_by': {				
            out.order = query[key]
            break
        }

        case 'exclusive':
            if(query[key] === 'true'){
                exclusive = true
            }
            else{
                exclusive = false
            }
            break

        default:
            let column = key
            let value = query[key]
            let modelField = entries.find(x => x.as === column)
            let numerics = ['integer','decimal','bigint','float','real','double']
            if(modelField){
                if(value === 'true'){
                    out.where[modelField.key] = true
                }
                else if(value === 'false'){
                    out.where[modelField.key] =  false
                }
                else if(value === null || value === 'null'){
                    value = null
                    out.where[modelField.key] =  null
                }
                else if(numerics.includes(modelField.dataType) && value !== null){
                    if(modelField.dataType === "integer"){
                        out.where[modelField.key] = parseInt(value, 10)
                    }
                    else{
                        out.where[modelField.key] = parseFloat(value)
                    }
                }
                else{
                    out.where[modelField.key] = `${value}`
                }
            }
            break
        }
    }
    if (Object.keys(out.where).length === 0) {
        out.where = undefined
    }

    return out
}

/**
 * @author N4cho!
 * @description Generates a list of ModelFields based on a string of field alises
 * - a `validalias` will return an object corresponding to the `[x].as` property from the list provided
 * - an `invalidalias` will be ignored completely
 * - a `validalias(otherAlias1,otherAlias2,...)` indicates a nested object and will generate another list on the `[x].fields` property
 * - a `validalias(*)` will generate a list with all nested fields found
 * - when the generated list is empty, the entire list provided will be returned
 * @param {string} str
 * @param {[{key:string, as:string, fields?:[{key:string, as:string}], getter?:string}]} fields
 * @returns {{fields:[], expand:boolean}}
 * @memberof Utils
 */
function genFields(str, fields){
    let out = {
        fields: [],
        expand: false
    }
    let field = ''
    let objfield = []
    let parent = ''
    let subprop = false
    for (let i = 0; i < str.length; i++) {
        let char = str.charAt(i)
        if (char === ',') {
            if (subprop) {
                let modelParentField = fields.find(x => x.as === parent)
                let modelField = modelParentField.fields.find(x => x.as === field)
                objfield.push(modelField)
            }
            else {
                let modelField = fields.find(x => x.as === field)
                if (modelField) {
                    out.fields.push(modelField)
                }
            }
            field = ''
        }
        else if (char === '(') {
            parent = field
            field = ''
            subprop = true
        }
        else if (char === ')') {
            subprop = false
            let modelParentField = fields.find(x => x.as === parent)
            let modelField = modelParentField.fields.find(x => x.as === field)
            let obj = {}
            if (modelField) {
                objfield.push(modelField)
            }
            obj.key = modelParentField.key
            obj.as = modelParentField.as
            obj.getter = modelParentField.getter
            obj.fields = objfield
            field = ''
            parent = ''
            out.fields.push(obj)
            out.expand = true
            objfield = []
        }
        else if (char === '*' && subprop) {
            objfield = []
            objfield = fields.find(x => x.as === parent).fields
            field = ''
        }
        else {
            field += char
        }
        if (i === str.length - 1 && char !== ')' && char !== '(' && char !== ',') {
            let modelField = fields.find(x => x.as === field)
            if (modelField) {
                out.fields.push(modelField)
            }
            field = ''
        }
    }
    if (out.fields.length === 0) {
        out.fields = fields
    }

    
    return out
}

/**
 * @author N4cho!
 * @description Generates an object to fullfill a sequelize query with the determined conditions and queries provided
 * @param {string[]} columns
 * @param {string[]} values
 * @param {[{key:string, as:string, dataType:string, required:boolean, autoincrement:boolean}]} fields
 * @memberof Utils
 */
function genSequelizeQuery(query, fields, exclusive=false){
    // set initial data and auxiliar variables
    let where = {}
    let momentables = ['date','dateonly']
    let numerics = ['integer','decimal','bigint','float','real','double']
    let banned = ['fields','limit','offset','order_by','exclusive']
    let columns = []
    let values = []
    for(let key in query){
        if(!banned.includes(key)){
            columns.push(key)
            values.push(query[key])
        }
    }
    let powerMode = columns.reduce((cond, value) => cond || value.includes('('), false)
    let pendent
    let orList = []
    let andList = []
    for(let i in columns){
        // deconstruct query
        let value = values[i]
        let alias = columns[i]
        let [column, bundle] = alias.split('(')
        alias = column
        let [condition, op] = bundle ? bundle.replace(')','').split(',') : []
        let field = fields.find(f => f.as === alias)
        let key = field.key 
    
        // format values in rescpetive types
        if(value === 'true'){
            value = true
        }
        if(value === 'false'){
            value = false
        }
        if(value === 'null'){
            value = null
        }
        if(value !== null){
            if(numerics.includes(field.dataType)){
                if(field.dataType === 'integer'){
                    value = parseInt(value, 10)
                }else{
                    value = parseFloat(value)
                }
            }
            else if(momentables.includes(field.dataType)){
                value = moment(value,'DD/MM/YYYY HH:mm:ss')
            }
        }
        // powerMode indicates if complex filtering has to be done
        if(powerMode){
            // each possible query is defined and mapped, string convertions for integers are contemplated
            let opMap = {
                'eq':{[key] : {[Op.eq] : value}},
                '<':{[key] : {[Op.lt] : value}},
                '>':{[key] : {[Op.gt] : value}},
                '<eq':{[key] : {[Op.lte] : value}},
                '>eq':{[key] : {[Op.gte] : value}},
                '<>':{[key] : {[Op.ne] : value}},
                'contains':{[key] : 
                    numerics.includes(field.dataType) ?
                    Sequelize.where(Sequelize.cast(Sequelize.col(key), 'varchar'),{[Op.like]: `%${value}%`})
                    : {[Op.like] : `%${value}%`}
                },
                '!contains':{[key] : 
                    numerics.includes(field.dataType) ?
                    Sequelize.where(Sequelize.cast(Sequelize.col(key), 'varchar'),{[Op.notLike]: `%${value}%`})
                    : {[Op.notLike] : `%${value}%`}
                },
                'startsWith':{[key] : 
                    numerics.includes(field.dataType) ?
                    Sequelize.where(Sequelize.cast(Sequelize.col(key), 'varchar'),{[Op.like]: `${value}%`})
                    : {[Op.like] : `${value}%`}
                },
                '!startsWith':{[key] : 
                    numerics.includes(field.dataType) ?
                    Sequelize.where(Sequelize.cast(Sequelize.col(key), 'varchar'),{[Op.notLike]: `${value}%`})
                    : {[Op.notLike] : `${value}%`}
                },
                'endWith':{[key] : 
                    numerics.includes(field.dataType) ?
                    Sequelize.where(Sequelize.cast(Sequelize.col(key), 'varchar'),{[Op.like]: `%${value}`})
                    : {[Op.like] : `%${value}`}
                },
                '!endWith':{[key] : 
                    numerics.includes(field.dataType) ?
                    Sequelize.where(Sequelize.cast(Sequelize.col(key), 'varchar'),{[Op.notLike]: `%${value}`})
                    : {[Op.notLike] : `%${value}`}
                }
            }

            // asign the query to the condition indicated and deal with the unknown query
            if(condition === 'and'){
                if(pendent){
                    andList.push(pendent)
                    pendent = null
                }
                andList.push(opMap[op])
            }else if(condition === 'or'){
                if(pendent){
                    orList.push(pendent)
                    pendent = null
                }
                if(andList.length > 1){							
                    orList.push({[Op.and] : andList})	
                    andList = []
                }
                if(andList.length === 1){							
                    orList.push(andList[0])
                    andList = []
                }
                // penden can either go inside an and or or block, saved for later usage
                pendent = opMap[op]
            }
        }
        else{
            // just checks if it is equals
            where[key] = value
        }
    }

    if(where !== undefined){
        // post processing of the different lists of unfinished conditions
        // these can't be dealt one by one but rather as a group
        if(powerMode){
            if(pendent && andList.length === 0){
                orList.push(pendent)
                pendent = null
            }
            else if(pendent && andList.length > 0){
                andList.push(pendent)
                orList.push({[Op.and] : andList})	
                andList = []
                pendent = null
            }
            else if(!pendent && andList.length > 0){
                orList.push({[Op.and] : andList})	
                andList = []
            }

            if(orList.length > 0){
                where = {[Op.or]:orList}
            }
            else if(andList.length === 1){
                where = andList[0]
            }
            else if(andList.length > 1){
                where = {[Op.and] : andList}
            }
        }
        // map queries with like operator
        else if(!exclusive){
            let condition = []
            for(let key in where){
                let modelField = fields.find(x => x.key === key)
                if(numerics.includes(modelField.dataType)){
                    condition.push({[key]:
                        Sequelize.where(
                            Sequelize.cast(Sequelize.col(key), 'varchar'),
                            {[Op.like]: `%${where[key]}%`}              
                            )
                    })
                }
                else{
                    condition.push({[key]: {[Op.like]: where[key]}})
                }
                
            }
            where = {[Op.and]:condition}
        }
    }
    return where
}

module.exports.dequerylize = dequerylize
module.exports.procDequerylize = procDequerylize