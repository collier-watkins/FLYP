import React, { Component } from "react";
import "./App.css";
import * as api from "./apiCalls.js";
import * as IDparse from "./IDparse.js";
//BTW: cant use : "child_process" in react...

// Demo Presentation sugestions
// 1. How do we power off the device? exec call from react?
// 2. Card swipe timeout to prevent someone from busting too many card swipes for their buds
// 3. Better UX for displaying the status of the tracker
// 4. Logic to deny attendance entries for the same student for the same day
// 5. Deb installer from Electron ( Pi3 is armhf, not armv7l(?) )
// ...
// oo. Super stretch goal of displaying student signin pictures, but really dont focus on this

// TODO: Fix the UX that tells if the input UIN is not in the roster
//
// TODO: Allow replacing an RFID or MagID link to UIN (somehow)
//
// TODO: Find a better place to pull the current professors from
// ----> Not componentDidMount() b/c internet connectivity could be shoddy
// ----> If no prof roster is pulled then we need to poll for it every couple of seconds
//
// TODO: If prof has no classes, let em know
//
// TODO: Put prof swipes and student swipes into their own functions
// ----> Close class is being called from students sometimes

class ClassList extends Component {

  handleClick(i) {
    this.props.onClick(i);
  }

  render() {
    return(
      <ul>
        {this.props.items.map( item => (
          <button 
            className = "classButton"
            key = {item.text}
            onClick = {() => this.handleClick(item.text)}
          >
            {item.text}
          </button>
        ))}
      </ul>
    );
  }

}

class NumpadButton extends Component {

  render() {
    return(
      <button
        onClick = {() => this.props.onClick()}
        className = "numPad"
      >
        {this.props.value}
      </button>
    );
  }

}

class Numpad extends Component {

  renderButton(i) {
    return(
      <NumpadButton
        value = {i}
        onClick = {() => this.handleClick(i)}
      />
    );
  }

  handleClick(i) {
    this.props.onClick(i);
  }

  render() {
    return(
      <div>
        <div>
          {this.renderButton(7)}
          {this.renderButton(8)}
          {this.renderButton(9)}
        </div>
        <div>
          {this.renderButton(4)}
          {this.renderButton(5)}
          {this.renderButton(6)}
        </div>
        <div>
          {this.renderButton(1)}
          {this.renderButton(2)}
          {this.renderButton(3)}
        </div>
        <div>
          {this.renderButton("clear")}
          {this.renderButton(0)}
          {this.renderButton("backspace")}
        </div>
      </div>
    );
  }

}

class Submitbutton extends Component {

  render() {
    return(
        <button
          className = "Submitbutton"
          onClick = {this.props.onClick}
        >
          Submit
        </button>
    );
  }

}

// Master component: App
class App extends Component {

  constructor(props) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
    this.handleNumpad = this.handleNumpad.bind(this);
    this.handleCardReader = this.handleCardReader.bind(this);
    this.handleSelectedClass = this.handleSelectedClass.bind(this);
    this.handleExit = this.handleExit.bind(this);
    this.state = {
      UIN: "",
      CardReader: "",
      tracking: false,
      linking: false,
      attendanceStatus: false,
      student: "",
      prof: {},
      currClass: "FLYP",
      date: "",
      inputStatus: " ",
      items: [],
      Roster: [{}] 
    };

  }

  componentDidMount() {

    console.log( "Mounted" );
    this.interval = setInterval( () => this.tick(), 300 );
    this.checkProf();

  }

  checkProf( ) {
    
    let date = new Date();
    const YYYY = date.getFullYear();
    const MM = date.getMonth() + 1; // Jan = 0
    const DD = date.getDate();
    let YYYY_MM_DD = YYYY + '_' + MM + '_' + DD;
    this.setState({ date: YYYY_MM_DD });
    
    api.getProfessors().then( data => {

      this.setState({ Roster: data.professors });

    });

  }

  fetchClasses() {

    const profUIN = this.state.prof.uin;

    api.getCourses( profUIN ).then( data => {

      console.log( "Profs courses:", data.data );
      for( let i = 0; i < data.data.length; ++i ) {

        const className = data.data[i].course_id;
        const key = className;
        console.log( "Adding class:" + className );

        const newItem = { text: className, key: key };

        this.setState( prevState => ({ 
          items: prevState.items.concat( newItem )
        }));
      }

    });

  }

  handleSelectedClass( chosenClass ) {

    console.log( "Chose class: " + chosenClass );

    this.setState( prevState => ({ 
      tracking: !prevState.tracking,
      currClass: chosenClass
    }));

    const currentDate = this.state.date;
    api.addAttendanceDay( chosenClass, currentDate );

    console.log( "Pulling student roster for: " + chosenClass );

    api.getRoster( chosenClass ).then(data => {

      this.setState({ Roster: data.data });

    });
    
  }

  trackAttendance( inputID, theClass, date, student ) {

    api.trackAttendance( inputID, theClass, date ).then( data => {

      //data.num_attended data.num_class_days
      const attendanceRecord = data.num_attended;
      console.log( "Attendance Record:", attendanceRecord );
      const message = "Attendance Recorded! : " + student + " -- Days attended: " + attendanceRecord;
      this.setState({ 
        student: student,
        attendanceStatus: true,
        inputStatus: message
      });

      this.resetErrorMsg();
      this.succAttendanceFeedback();

    });

  }

  // Im so sorry
  checkRoster( cardValue, inputType ) {
    
    console.log( "Checking roster..." );

    const Roster = this.state.Roster;
    const date = this.state.date;
    const theClass = this.state.currClass;
    const tracking = this.state.tracking;
    const profUIN = this.state.prof.uin;
    const linking = this.state.linking;

    let recognizedCard = false;
    let parsedCard = "";
    let linkingStatus = false;

    if( inputType === "UIN" ) {

      const inputUIN = cardValue;

      console.log( "UIN input: " + Roster.length );
      console.log( "ROSTER:", Roster);

      if( profUIN === inputUIN && tracking === true ) {

        console.log( "Tracking Stopped, Prof logged out" );
        this.setState( prevState => ({
          tracking: !prevState.tracking,
          currClass: "FLYP",
          inputStatus: "Logging out...",
          items: [],
          prof: {}
        }));

        this.resetErrorMsg();
        this.checkProf();

      }

      else {

        var UINFound = false;
        for( let i = 0; i < Roster.length; ++i ) {

          const rosterUIN = Roster[i].uin;

          console.log( "Roster uin: " + rosterUIN );

          if( rosterUIN === inputUIN ) {
            UINFound = true;

            if( linking === true ) {

              const cardReader = this.state.cardReader;
              let message = "Trying Card link";

              // Update local roster
              if( cardReader[0] === "r" ) {//&& cardReader.length === 9 ) {
                Roster[i].rfidNum = cardReader;
                api.updateCardOrRfid( inputUIN, cardReader );
                message = "Linking UIN to RFID" //+ inputUIN + " to RFID: " + cardReader;
                linkingStatus = true;
              }
              else if( cardReader[0] === "m" ) {//&& cardReader.length > 11) { // mightbe 16
                Roster[i].cardNum = cardReader;
                api.updateCardOrRfid( inputUIN, cardReader );
                message = "Linking UIN to card swipe..." //+ inputUIN + " to magID: " + cardReader;
                linkingStatus = true;
              }
              else {
                message = "Bad read, try linking ID again";
              }

              this.setState({ 
                linking: false,
                inputStatus: message
              });
              this.resetErrorMsg();

            }

            // was else if --> ment the user had to swipe again to record or log in
            if( tracking === true ) {

              // Record students attedance
              const student = Roster[i].firstName;
              this.trackAttendance( inputUIN, theClass, date, student );

            }

            else { // log professor in

              api.professorExists( inputUIN ).then( data => {

                const existance = data.data;

                if( existance === true ) {

                  console.log( "Prof login:", data );
                  this.setState({
                    prof: Roster[i],
                    trackingStatus: "Logging in..."
                  });

                  this.fetchClasses();
                  this.resetErrorMsg();

                }

              });

            }

          }

        } // end of massive for loop

        if( linkingStatus === false && linking === true ) {

          console.log( "User failed linking UIN to card value" );
          this.setState({ 
            linking: false,
            trackingStatus: "ID link failed"
          });
          this.resetErrorMsg();

        }

        else if( UINFound === false ) {
          console.log( "UIN not in database" );
          this.setState({ 
            trackingStatus: "UIN not found in roster"
          });
          this.resetErrorMsg();
        }

      } // end of massive if statement

    } // end of UIN conditional

    else if( inputType === "CardReader" && linking === false ) {
      
      if( IDparse.magParser( cardValue, true ) === true ) {

        console.log( "Mag Stripe input" );
        let parsedMagID = "m" + IDparse.magParser( cardValue, false );
        parsedCard = parsedMagID;
        console.log( "Parsed MagID: " + parsedMagID );

        if( parsedMagID === this.state.prof.cardNum && tracking === true && linking === false ) {

          console.log( "Tracking Stopped, Prof logged out" );
          this.setState( prevState => ({
            tracking: !prevState.tracking,
            currClass: "FLYP",
            inputStatus: "Logging out...",
            items: [],
            prof: {}
          }));

          this.resetErrorMsg();
          this.checkProf();

          return;

        }

        for( let i = 0; i < Roster.length; ++i ) {

          const cardNum = Roster[i].cardNum;
          console.log( "magID cardNum: " + cardNum );

          if( cardNum === parsedMagID ) {

            recognizedCard = true;

            if( tracking === true ) {

              console.log( "Attendance recorded" );
              const student = Roster[i].firstName;
              const studentUIN = Roster[i].uin;
              this.trackAttendance( studentUIN, theClass, date, student );

            }

            //else if( parsedMagID === this.state.prof.cardNum && tracking === false ) {
            else {

              this.setState({
                prof: Roster[i],
                inputStatus: "Logging in..."
              });

              this.resetErrorMsg();
              this.fetchClasses();

            }

          }

        }

      }

      else if( IDparse.rfidParser( cardValue, true ) === true ) {

        console.log( "RFID input" );
        let parsedRFID = "r" + IDparse.rfidParser( cardValue, false );
        parsedCard = parsedRFID;
        console.log( "Parsed RFID: " + parsedRFID );

        if( parsedRFID === this.state.prof.rfidNum && tracking === true && linking === false ) {

          console.log( "Tracking Stopped, Prof logged out" );
          this.setState( prevState => ({
            tracking: !prevState.tracking,
            currClass: "FLYP",
            inputStatus: "Logging out...",
            items: [],
            prof: {}
          }));

          this.resetErrorMsg();
          this.checkProf();

          return;

        }

        for( let i = 0; i < Roster.length; ++i ) {

          const cardNum = Roster[i].rfidNum; // OMG
          console.log( "RFID cardNum: " + cardNum );

          if( cardNum === parsedRFID ) {

            recognizedCard = true;

            if( tracking === true ) {

              console.log( "Attendance recorded" );
              const student = Roster[i].firstName;
              const studentUIN = Roster[i].uin;
              this.trackAttendance( studentUIN, theClass, date, student );

            }

            //else if( parsedRFID === this.state.prof.rfidNum && tracking === false ) {
            else {

              this.setState({
                prof: Roster[i],
                inputStatus: "Logging in..."
              });

              this.resetErrorMsg();
              this.fetchClasses();

            }

          }

        }

      }

      if( recognizedCard === false ) {

        let message = "Unrecognized Card: Please Input your UIN"; //+ parsedCard;

        if(IDparse.rfidParser( cardValue, true ) === true || IDparse.magParser( cardValue, true ) === true ) {

          this.setState({
            linking: true,
            cardReader: parsedCard,
            inputStatus: message
          });

        }

        else {

          message = message + " -- Bad Read, try again";

          this.setState({
            linking: false,
            cardReader: parsedCard,
            inputStatus: message
          });

        }

        this.resetErrorMsg();

      }

    }

  }

  handleClick() {

    const UIN = this.state.UIN;

    if( UIN.length === 9 ) {

      console.log( "Submit button clicked, captured value = " + UIN );

      this.checkRoster( UIN, "UIN" );

    }

    else {

      console.log( "UIN input length is not 9, try again" );
      this.setState({ 
        linking: false,
        inputStatus: "Invalid UIN input"
      });

      this.resetErrorMsg();

    }

    // Clear the UIN when we are done
    this.setState({ UIN: "" });

  }

  tick(){

    this.refs.MMM.focus();
    const cardReaderValue = this.refs.MMM.value;
    //this.setState({ inputStatus: " " });

    // Increase interval if the whole card reader is not caputred
    if( cardReaderValue.length >= 8 ) {

      console.log( "Sent Raw Card: " + cardReaderValue );

      this.checkRoster( cardReaderValue, "CardReader" );

      this.refs.MMM.value = "";
      this.setState({ UIN: "" });

    }

    else {
      this.refs.MMM.value = "";
    }

  }

  resetErrorMsg() {
    setTimeout( () => { this.setState({ inputStatus: " " });}, 3000 ); // milliseconds
  }

  succAttendanceFeedback() {
    setTimeout( () => { this.setState({ attendanceStatus: false });}, 3000 ); // milliseconds
  }

  handleCardReader() {
    
    const cardReaderValue = this.refs.MMM.value;
    //console.log( "Captured Card Reader: " + cardReaderValue );
    //this.setState({ CardReader: cardReaderValue });

  }

  handleNumpad(i) {
    if( i === "clear" ) {
      const newValue = ""
      this.setState({ UIN: newValue });
    }
    else if( i === "backspace" ) {
      this.setState( prevState => ({ UIN: prevState.UIN.slice(0, -1) }));
    }
    else if( this.state.UIN.length === 9 ) {
      console.log( "Too long" );
    }
    else {
      this.setState( prevState => ({ UIN: prevState.UIN + i }));
    }
  }

  handleExit() {
    window.close();
  }

  render() {

    const currClass = this.state.currClass;
    const UIN = this.state.UIN;
    const trackingStatus = this.state.tracking;
    const items = this.state.items;
    const linking = this.state.linking;
    const attendanceStatus = this.state.attendanceStatus;
    const inputStatus = this.state.inputStatus;

    return (

      <div>

        <div className = "Header">
          Welcome to: {currClass}
        </div>

        <div id = "wrapCenter" className = "topHUD" hidden = {trackingStatus}>
          <div id = "center">
            <b>Please swipe/scan your ID and select a class to start tracking attendenace</b>
            <div>
              If you do not have your student ID, enter your UIN and tap submit. 
            </div>
            <ClassList
              items = {items}
              onClick = {i => this.handleSelectedClass(i)}
            />
          </div>
        </div>

        <div id = "wrapCenter" className = "topHUD" hidden = {!trackingStatus}>
          <div id = "center">
            <b>Please swipe or scan your student ID for attendance.</b>
            <div>
              If you do not have your student ID, enter your UIN and tap submit. 
            </div>
          </div>
        </div>

        <div id = "wrapCenter" className = "linkingCard" hidden = {!linking}>
          <b>Unrecognized MagStripe or RFID card input</b> 
          <div>
            please input your UIN using the keypad to link it to your card.  
          </div>
        </div>

        <div 
          id = "wrapCenter" 
          className = {attendanceStatus ? "greenBG" : "" }
        >
          - <b>{inputStatus}</b> -
        </div>

        <br/>
        <div id = "wrapCenter"> 
          <div id = "center">
            <Submitbutton
              onClick = { () => this.handleClick() }
            />

            <div>
              <input 
                type = "text"
                hidden = {false}
                autoFocus = {true}
                ref = "MMM"
                onChange = {() => this.handleCardReader()}
                className = "commando"
              />
            </div>

            <div><b>UIN:</b>{UIN}</div>
            <Numpad
              onClick = {i => this.handleNumpad(i)}
            />

            <div 
              hidden = {trackingStatus}
            >
              <button
                className = "exitButton"
                onClick = {() => this.handleExit()}
              >
                Power
              </button>
            </div>

          </div>
        </div>

      </div>
    );
  }
}

export default App;
