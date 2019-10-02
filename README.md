#sequelize-modeler

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT) [![npm version](https://badge.fury.io/js/sequelize-modeler.svg)](https://badge.fury.io/js/sequelize-modeler) [![node](https://badgen.net/npm/node/sequelize)](https://www.npmjs.com/package/sequelize-modeler)
----
sequelize-modeler is powerful set of tools built in around [Sequelize](https://sequelize.org/) and [Express](https://expressjs.com/) focused in REST API functionalities such as aliased fields, dynamic database connections, powerful query filtering and formatting

##Install

```
$ npm install --save sequelize-modeler
```

##Usage

####Defining a Model:

```js
// SomeModel.js
const Model = require('sequelize-modeler').Model

module.exports = class SomeModel extends Model{
    static init(sequelize, DataTypes, connectionId){
        let config = {
            options:{
                tableName: 'MyTable',
                primaryKey: 'myPrimaryKey',
                dateFormat: 'YYYY-DD-MM HH:mm:ss', // (optional) any moment format
                connectionId,
                sequelize,   
            },
            fields: {
                // field, alias, label and other properties are all optional, you can define your model normaly and they will be auto generated
                MyColumn:{
                    field: 'MyColumn',
                    as: 'MyColumnCustomName',
                    label: 'Name The Column Should be Showed With',
                    type: DataTypes.STRING,
                    defaultValue: 'Some Value',
                    allowNull: false,
                }
                ...
            },
        }
    }
}
```
####Initializing a Model:
----
Quick start:
```js
const Catalog = require('sequelize-modeler').Catalog
// initialize your sequelize instance
const sequelize = new Sequelize(...options)

// register your connection to the catalog
// connectionId will be a generated unique id
const connectionId = Catalog.setConnection(sequelize)

// initialize your models
// all models are returned mapped with their classnames and ready to use
const {MyModel, MyOtherModel, ...etc} = Catalog.initialize([...ModelClasses], connectionId)

MyModel.findAll().then(instances => {
    //do stuff here
})
```

Defining your own connection ids: 
```js
Catalog.setConnection('your id',sequelizeInstance1)
Catalog.setConnection('other id',sequelizeInstance2)
```

#### using a model:
----
__Getting a custom formatted instance:__

For the following Model Fields:
```js
...
    fields:{
        NumberColumn:{
            field: 'NumberColumn',
            as: 'number',
            type: DataTypes.INTEGER,
        },
        DateColumn:{
            field: 'DateColumn',
            as: 'date',
            type: DataTypes.DATE,
            format: 'dddd, MMMM Do YYYY, h:mm:ss a'
        },
    }
...
```
You have to call the `format()` method of an instance
```js
let instance = await theModel.findOne({...})
console.log(instance.format())
```
Output would be
```json
{
    "number": 0,
    "date": "Sunday, February 14th 2010, 3:25:50 pm"
}
```

__Getting your model meta-data:__
```js
theModel.getFields()
```
Output would look like this
```json
[
    {
        "visible": true,
        "filterable": true,
        "key": "columnCustomName", // field.as
        "label": "UI Label",
        "dataType": "decimal",
        "required": true,
        "autoIncrement": false
    },
    {
        "visible": true,
        "filterable": true,
        "key": "otherField",
        "label": "otherField",
        "dataType": "char",
        "required": true,
        "autoIncrement": false
    },
    {
        "visible": true,
        "filterable": true,
        "key": "dateColumn",
        "label": "Date",
        "dataType": "date",
        "format": "dddd, MMMM Do YYYY, h:mm:ss a",
        "required": true,
        "autoIncrement": false
    },
]
```

__Generate an api endpoint:__

```js
const router = require('express').Router()
router.use('/theModel',theModel.generateApi())
```
The `.generateApi()` method returns an express router with:
- `[GET] '/theModel'` responds with a paginated list of all rows
- `[GET] '/theModel/:id'` responds with a single row with the matching id (primaryKey)
- `[GET] '/theModel/meta'` responds with some meta-data of the model like th field list, number of rows, visible and filterable fields also according to the request query (more on that here)
- `[POST] '/theModel'` creates an instance, saves it and returns it (response is false if creation fails)
- `[PUT] '/theModel/:id'` edits the instance and returns the new value
- `[DELETE] '/theModel/:id'` deletes the instance and responds with true or false accordingly

All enpoints responses and expected data is aliased with the corresponding configuration.
Supported query parameters for `[GET]`:

- ___Fields :___ `?fields=field1,field2,field3` specifies wich fields the instances are be sent with
- ___Order :___ `?order_by=field1(asc),field2(desc),field3` specifies how data should be ordered before pagination, with priority given by the order sent (`field1 > field2 > field3`). direction defaults to `asc`
- ___Pagination :___ `?limit=30&offset=2` where limit defines page size, and offset defines number of page, the given example would return rows 31 to 60. `limit` defaults to `25` and `offset` defaults to `1`
- ___Filtering :___ 
  - ___simple filter :___ `?foo=bar&exclusive=true` will return all rows where `foo` column conains `bar`. Useful for filtering data tables or autocomplete inputs
    ```json
    [{ "foo":"bar" }, { "foo":"barbacue" }, { "foo":"bombardier" }] 
    ```
    it also applies to numeric fields `?number=12`
    ```json
    [{ "number":12 }, { "number":33123 }, { "number":12999 }] 
    ```
  - ___exclusive filter :___ `?foo=bar` will return all rows where `foo` column equals to `bar`, all values are converted to their respective type with their respective formatting declared in the model configuration
  - ___power filtering :___ Allows for complex querying `?field1(and,contains)=value1,field2(and,>)=value2,field3(or,<>)=value3`
  where the expected format is `fieldName(condition,operator)=value`, if the power format is matched at least once the api will expect it on each of the fields. numeric fields are supported by all operators.
    - ___conditions :___
      - `and` 
      - `or`
    - ___operators :___ 
      - `eq` : equal to
      - `<` : lower than
      - `>` : greater than
      - `<eq` : lower than or equal to
      - `>eq` : greater than or equal to
      - `<>` : not equal to
      - `contains` : contains
      - `!contains` : not contains
      - `startsWith` : starts with
      - `!startsWith` : not starts with
      - `endWith` : ends with
      - `!endWith` : not ends with
    
__Adding extra middlewares :__
Middlewares can be added to all different generated endpoints either before or after them, if the response should be sent, just add `next:true` to the options and the reponse will be carried to the next middleware as `req.body._carried_` this can be either an instance, a list of instances, an error, or `undefined` depending on the endpoint and if was successful or failed.
```js
const router = require('express').Router()

// we will add this middleware before the generated get endpoint
let justReds = (req, res, next) => {
    req.query.color = 'red'
    req.query.exclusive = false
    // do whatever you want here
    next()
}

router.use('/theModel',theModel.generateApi({
    middlewares:{
        get:[{place:'before', handler: justReds}]
    }
}))
```
Example using carried data:

```js
const router = require('express').Router()

const afterMiddleware = (req, res, next) => {
    let createdInstanceOrError = req.body._carried_
    // handle you output here
}

router.use('/theModel',theModel.generateApi({
    next: true,
    middlewares:{
        post:[{place:'after', handler: afterMiddleware}]
    }
}))
```

__Other options :__

`config.model` - Model to be used (`Model | Function | string`)
`config.connection` - Connection to be used when model is string (`Connection | string`)

Examples of dynamic model:
```js
const { Model, Catalog } = require('sequelize-modeler')
const modelList = require('path/to/list/of/model/classes') // list of not initialized models

const connection = Catalog.getConnection('myId') // active connection

for(let model of modelList){
    // models will be initialized in their respective generated routers
    router.use(`${model.name}`,Model.generateApi({connection, model}))// an api fo every model 🚀 
}
```
Using the model name:
```js
const { Model, Catalog } = require('sequelize-modeler')

let model = 'SomeModelName'
let connection = Catalog.getConnection('myId') // active connection

router.use(`${model}`,Model.generateApi({connection, model}))
```

Using a Function to infer the model :
```js 
const { Model, Catalog } = require('sequelize-modeler')

const model = (req,res,next) => { // req, res, next passed from express
    let model
    // do stuff...
    // populate model with some initialized model
    return model
}

// note that connection is no longer required, since you return an initialized model

router.use(`${model}`,Model.generateApi({model}))
```

`config.failed` - callback to be excecuted when creation fails
```js 
const router = require('express').Router()

const failed = (req,res,next) => {
    // instance can be undefined
    // this will be excecuted when something expected fails, like an insert, or edition
}

router.use('/theModel',theModel.generateApi({failed}))
```

`config.failed` - callbback to be excecuted in case of an internal error, by deafult `res.status(500).send('Internal Server Error')`
```js 
const router = require('express').Router()

const error = (req,res,next,error) => {
    // this will be excecuted when something unexpected like sequelize throwing an error
}

router.use('/theModel',theModel.generateApi({error}))
```

`config.empty` - Map of values to assign to null fields of each different dataType, or for every dataType
```js
// empty map
{
    integer: number
    decimal: number, 
    bigint: number, 
    float: number, 
    real: number, 
    double: number,
    string: string,
    text: string,
    citext: string,
    date: Moment,
    dateonly: Moment,
    boolean: boolean,
    enum: [any],
    array: [any],
    json: Object,
    jsonb: Object,
    blob: BlobPart,
    uuid: string,
    cidr: any,
    inet: any,
    macaddr: any,
    range: [any],
    geometry: any,
    all: any,
}
```

`config.apiname` - Name used to build href of models, all instances have a `href: http://example.com/apiname/:id`, you get to change the `apiname` part of it

`config.next` - Toggles the excecution of `next()`, defaults to `false`

`config.middlewares` - Extra optional middlwares to be added `{[{place:'before'|'after', handler:Middleware}]}`  place indicates if middlware must be excecuted before or after the generated one, see example above

`config.get` - Toggles the `[GET]` method, defaults to `true`

`config.getOne` - Toggles the `[GET] /:id` endpoint, defaults to `true`

`config.post` - Toggles the `[POST]` method, defaults to `true`

`config.put` - Toggles the `[PUT]` method, defaults to `true`

`config.delet` - Toggles the `[DELETE]` method, defaults to `true`

`config.meta` - Toggles the `/meta` endpoint, defaults to `true`

`config.fields` - List of fields to be used by the model, all instances and meta-data will be mapped to the given field list

```js
const router = require('express').Router()

// you don't need to put every atribute of each field, just what you want
let fields = [
    {
        "key": "Column1",
        "as": "one",
        "dataType": "decimal",
    },
    {
        "key": "Column2",
        "as": "two",
        "dataType": "date",
        "format": "dddd, MMMM Do YYYY, h:mm:ss a",
    },
    {
        "key": "Column56",
        "as": "thisCoulmnDoesNotExist",
        "dataType": "string",
    }

]

router.use('/theModel',theModel.generateApi({fields}))
```
Output instances would be like this:
```js
{
    one: 15,
    two: "Sunday, February 14th 2010, 3:25:50 pm",
    thisCoulmnDoesNotExist: null,
    href: "http://example.com/theModel/15"
}
```





