import React from 'react';
import { BrowserRouter as Router, Route, Switch, Link } from 'react-router-dom';
import MainPage from '../components/MainPage';
import ExamplesPage from './components/ExamplesPage';

const App = () => {
  return (
    <Router>
      <div>
        <nav>
          <ul>
            <li>
              <Link to='/'>Home</Link>
            </li>
            <li>
              <Link to='/examples'>Examples</Link>
            </li>
          </ul>
        </nav>
        <Switch>
          <Route path='/' exact component={MainPage} />
          <Route path='/examples' component={ExamplesPage} />
        </Switch>
      </div>
    </Router>
  );
};

export default App;