import { Component } from "react";
import ErrorState from "./ErrorState";
export default class ErrorBoundary extends Component{state={failed:false};static getDerivedStateFromError(){return{failed:true};}componentDidCatch(error,info){if(__DEV__)console.error("UI error",error,info);}render(){if(this.state.failed)return <ErrorState title="This screen couldn't open" message="A display error occurred. Your data is safe." onRetry={()=>this.setState({failed:false})}/>;return this.props.children;}}
