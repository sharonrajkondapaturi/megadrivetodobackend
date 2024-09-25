const express = require("express")
const path = require("path")
const {open} = require("sqlite")
const sqlite3 = require("sqlite3").verbose()
const bodyparser = require('body-parser')
const app = express()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const {v4 : uuidv4} = require('uuid')
const dbPath = path.join(__dirname,"megadrive.db")
const cors = require("cors")
app.use(cors())
app.use(express.json())
app.use(bodyparser.json())
let db = null;

const initializeDbAndServer = async()=>{
    try{
        db=await open({
            filename:dbPath,
            driver:sqlite3.Database
        });
        app.listen(4000,()=>{
            console.log(`Server is listening http://localhost:4000`);
        })
    }
    catch(error){
        console.log(`DB error : ${error.message}`)
        process.exit(1)
    }
}

initializeDbAndServer()

const authenticationToken = (request,response,next)=>{
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if(authHeader !== undefined){
        jwtToken = authHeader.split(" ")[1]
    }
    if(authHeader == undefined){
        response.status(400)
        response.send("No Access Token")
    }
    else{
        jwt.verify(jwtToken,"assigned",(error,payload)=>{
            if(error){
                response.send("Invalid Access Token")
            }
            else{
                request.user_id = payload.id
                request.username = payload.username
                request.email = payload.email
                next()
            }
        })
    }
}

const todoDetails = (eachTodo)=>{
    return{
        id:eachTodo.id,
        user_id:eachTodo.user_id,
        todo:eachTodo.todo,
        description:eachTodo.description,
        status:eachTodo.status,
        priority:eachTodo.priority
    }
}

const userDetails = (eachUser)=>{
    return{
        id:eachUser.id,
        username:eachUser.username,
        email:eachUser.email,
        password:eachUser.password
    }
}

//user registeration API
app.post("/register",async(request,response)=>{
    const {username,password,email} = request.body
    const newUserQuery = `SELECT * FROM users WHERE username="${username}";`
    const checkUser = await db.get(newUserQuery)
    const hashPassword = await bcrypt.hash(password,10)
    if(checkUser === undefined){
        const newUser = `INSERT INTO users(username,password,email)
        VALUES ("${username}","${hashPassword}","${email}")
        `
        await db.run(newUser)
        response.send("User created successfully")
    }
    else{
        response.status(400)
        response.send("User already exits")
    }
})

//User Login Api
app.post("/login",async(request,response)=>{
    const {username,password} = request.body
    const userQuery = `
    SELECT * FROM users WHERE username="${username}"
    `
    const dbUser = await db.get(userQuery)
    if(dbUser === undefined){
        response.status(400)
        response.send("Invalid user")
    }
    else{
        const isPasswordMatched = await bcrypt.compare(password,dbUser.password)
        if(isPasswordMatched === true){
            const payload = {id:dbUser.id,username:username,email:dbUser.email}
            const jwtToken = jwt.sign(payload,"assigned")
            response.send({jwtToken})
        }
        else{
            response.status(400)
            response.send("Invalid password")
        }
    }
})

//get user
app.get("/getuser",authenticationToken,async(request,response)=>{
    const {user_id} = request
    const getUser = `SELECT * FROM users WHERE id = ${user_id};`
    const getUserDetails = await db.all(getUser)
    response.send(getUserDetails.map(eachUser=> userDetails(eachUser)))
})

//edit user API
app.put("/edituser",authenticationToken,async(request,response)=>{
    const {user_id} = request
    const {username} = request.body
    const updateUserQuery = `
    UPDATE users SET username = "${username}";
    `
    await db.run(updateUserQuery)
    const getUser = `SELECT * FROM users WHERE id = ${user_id};`
    const getUserDetails = await db.all(getUser)
    response.send(getUserDetails.map(eachUser=> userDetails(eachUser)))
})

//edit password API
app.put("/editpassword",authenticationToken,async(request,response)=>{
    const {user_id} = request
    const {password} = request.body
    const hashPassword = await bcrypt.hash(password,10)
    const updateUserQuery = `
    UPDATE users SET password = "${hashPassword}";
    `
    await db.run(updateUserQuery)
    const getUser = `SELECT * FROM users WHERE id = ${user_id};`
    const getUserDetails = await db.all(getUser)
    response.send(getUserDetails.map(eachUser=> userDetails(eachUser)))
})

//edit email API
app.put("/editemail",authenticationToken,async(request,response)=>{
    const {user_id} = request
    const {email} = request.body
    const updateUserQuery = `
    UPDATE users SET email = "${email}";
    `
    await db.run(updateUserQuery)
    const getUser = `SELECT * FROM users WHERE id = ${user_id};`
    const getUserDetails = await db.all(getUser)
    response.send(getUserDetails.map(eachUser=> userDetails(eachUser)))
})

//delete user API
app.delete("/deleteuser",authenticationToken,async(request,response)=>{
    const {user_id} = request
    const deleteUserQuery = `
    DELETE FROM todos WHERE id = "${user_id}";
    `
    await db.run(deleteUserQuery)
    const getUser = `SELECT * FROM users WHERE id = ${user_id};`
    const getUserDetails = await db.all(getUser)
    response.send(getUserDetails.map(eachUser=> userDetails(eachUser)))
})

//get todo List API
app.get("/todos",authenticationToken,async(request,response)=>{
    const {user_id} = request 
    const todoQuery = `
    SELECT * FROM todos WHERE user_id=${user_id};`
    const getTodo = await db.all(todoQuery)
    response.send(getTodo.map(eachTodo=> todoDetails(eachTodo)))
})

//addNewTodo API
app.post("/todos",authenticationToken,async(request,response)=>{
    const {user_id} = request
    const todoId = uuidv4()
    const {todo,description,status,priority} = request.body
    const todoQuery = `INSERT INTO todos (id,user_id,todo,description,status,priority) 
    VALUES ("${todoId}",${user_id},"${todo}","${description}","${status}","${priority}");`
    await db.run(todoQuery)
    const newTodoQuery = `SELECT * FROM todos WHERE user_id = ${user_id}`
    const getTodoQuery = await db.all(newTodoQuery)
    response.send(getTodoQuery.map(eachTodo=> todoDetails(eachTodo)))
})

//Update Todo API
app.put("/todos/:id",authenticationToken,async(request,response)=>{ 
    const {user_id} = request
    const {id} = request.params
    const {todo,description,priority} = request.body 
    const todoQuery = `UPDATE todos SET todo= "${todo}", description = "${description}", priority = "${priority}"  WHERE id = "${id}";`
    await db.run(todoQuery)
    const newTodoQuery = `SELECT * FROM todos WHERE user_id = ${user_id};`
    const getTodoQuery = await db.all(newTodoQuery)
    response.send(getTodoQuery.map(eachTodo=> todoDetails(eachTodo)))
})

//Update Todo Status API
app.put('/status/:id',authenticationToken,async(request,response)=>{
    const {user_id} = request
    const {status} = request.body
    const {id} = request.params
    const todoQuery = `UPDATE todos SET status = "${status}" WHERE id = "${id}";`
    await db.run(todoQuery)
    const getTodoQuery = `SELECT * from todos WHERE user_id = ${user_id};`
    const todoArray = await db.all(getTodoQuery)
    response.send(todoArray.map(eachTodo=> todoDetails(eachTodo)))
})

//Delete Todo API
app.delete("/todos/:id",authenticationToken,async(request,response)=>{
    const {user_id} = request
    const {id} = request.params
    const todoQuery = `DELETE FROM todos WHERE id = "${id}";`
    await db.run(todoQuery)
    const newTodoQuery = `SELECT * FROM todos WHERE user_id = ${user_id};`
    const getTodoQuery = await db.all(newTodoQuery)
    response.send(getTodoQuery.map(eachTodo=> todoDetails(eachTodo)))
})

module.exports = app