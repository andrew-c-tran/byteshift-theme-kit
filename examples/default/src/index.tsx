/**
 * The ByteShift theme: the panel's own look, and the starting point for `bst init`.
 *
 * A theme's entry exports its three components through defineTheme. Import your stylesheets here;
 * `bst build` gathers them into the pack's theme.css.
 */
import { defineTheme } from '@byteshift/theme';
import { ClimatePage } from './ClimatePage';
import { RadioPage } from './RadioPage';
import { Strip } from './Strip';
import './theme.css';

export default defineTheme({ Strip, ClimatePage, RadioPage });
